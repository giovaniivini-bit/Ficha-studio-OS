import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { LOGS_DIR, RUN_DIR, WORKTREES_DIR } from './paths.ts';
import { loadConfig } from './config.ts';
import { worktreeAdd, commit } from './git.ts';
import { buildWorkerSettings } from './permissions.ts';
import { parseLineList } from './zoning.ts';

const execAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, '../prompts');

export interface StartWorkerOpts {
  workerName: string;        // ex: "worker-A"
  slotId: string;            // ex: "tool-parse-datetime"
  milestone: string;         // ex: "M1"
}

export interface StartWorkerResult {
  worktreePath: string;
  branch: string;
  prompt: string;            // pra colar no terminal do Claude
  alreadyExists: boolean;
}

/**
 * Cria worktree + claim do slot + retorna prompt pro humano colar num Claude novo.
 * Modo manual (demo): NÃO faz spawn — o usuário abre o terminal em `cd <worktreePath>`.
 * Modo autônomo: `spawnWorker()` (abaixo) usa esta mesma base e faz o spawn headless.
 */
export async function startWorker(
  opts: StartWorkerOpts,
  promptTemplate: 'worker.md' | 'worker-headless.md' = 'worker.md',
): Promise<StartWorkerResult> {
  const { branchPrefix } = loadConfig();
  const branch = `${branchPrefix}/${opts.milestone}/${opts.slotId}`;
  const wtPath = path.join(WORKTREES_DIR, opts.workerName);

  let alreadyExists = false;
  try {
    await fs.access(wtPath);
    alreadyExists = true;
  } catch {
    /* novo */
  }

  if (!alreadyExists) {
    await worktreeAdd(opts.workerName, branch, 'main');
    // Claim dentro da branch do worker — commitado pra dashboard/reconciler
    // enxergarem via `git show <branch>:specs/slots/.../STATUS.txt`.
    const slotRel = path.join('specs', 'slots', opts.milestone, opts.slotId);
    const slotDir = path.join(wtPath, slotRel);
    await fs.mkdir(slotDir, { recursive: true });
    await fs.writeFile(path.join(slotDir, 'STATUS.txt'), `claimed:${opts.workerName}\n`);
    await fs.writeFile(path.join(slotDir, 'OWNER.txt'), `${opts.workerName}\n`);
    await commit(
      wtPath,
      `claim: ${opts.milestone}/${opts.slotId} by ${opts.workerName}`,
      [`${slotRel}/STATUS.txt`, `${slotRel}/OWNER.txt`],
    );
  }

  const template = await fs.readFile(path.join(PROMPTS_DIR, promptTemplate), 'utf-8');
  const prompt = template
    .replace(/\{\{workerName\}\}/g, opts.workerName)
    .replace(/\{\{slotId\}\}/g, opts.slotId)
    .replace(/\{\{milestone\}\}/g, opts.milestone)
    .replace(/\{\{branch\}\}/g, branch)
    .replace(/\{\{worktreePath\}\}/g, wtPath);

  return { worktreePath: wtPath, branch, prompt, alreadyExists };
}

// ─────────────────────────── modo autônomo (spawn headless) ───────────────────────────

/** Meta de um worker headless em execução — persistida em .ai-team/run/<worker>.json. */
export interface WorkerMeta {
  worker: string;
  slotId: string;
  milestone: string;
  branch: string;
  pid: number;
  startedAt: string;       // ISO
  logPath: string;
  settingsPath: string;
}

export interface SpawnWorkerResult extends WorkerMeta {
  worktreePath: string;
}

function metaPath(workerName: string): string {
  return path.join(RUN_DIR, `${workerName}.json`);
}

export async function readWorkerMetas(): Promise<WorkerMeta[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(RUN_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  } catch {
    return [];
  }
  const out: WorkerMeta[] = [];
  for (const f of files) {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(RUN_DIR, f), 'utf-8')) as Partial<WorkerMeta>;
      // valida o shape — outros .json no diretório (settings, contadores) não são metas
      if (
        typeof parsed.worker === 'string' &&
        typeof parsed.slotId === 'string' &&
        typeof parsed.milestone === 'string' &&
        typeof parsed.branch === 'string' &&
        typeof parsed.pid === 'number'
      ) {
        out.push(parsed as WorkerMeta);
      }
    } catch {
      /* meta corrompida — ignora (supervisor limpa) */
    }
  }
  return out;
}

export async function removeWorkerMeta(workerName: string): Promise<void> {
  try {
    await fs.unlink(metaPath(workerName));
  } catch {
    /* já não existe */
  }
}

/**
 * Spawn HEADLESS: worktree + claim (startWorker) e em vez de pedir pro humano colar
 * o prompt, executa `claude -p` como processo detached dentro da worktree, com
 * permissões geradas do TERRITORY.txt. O contrato de saída do worker é o estado do
 * slot commitado na branch: `done:<w>` ou `blocked:<motivo>`.
 */
export async function spawnWorker(opts: StartWorkerOpts): Promise<SpawnWorkerResult> {
  const cfg = loadConfig();
  const auto = cfg.autonomous;

  const base = await startWorker(opts, 'worker-headless.md');
  const slotDirRel = path.join('specs', 'slots', opts.milestone, opts.slotId);

  // Deps prontas ANTES do agente subir — headless não deve gastar turnos nisso.
  if (fsSync.existsSync(path.join(base.worktreePath, 'package.json'))) {
    try {
      await execAsync('pnpm', ['install', '--prefer-offline'], {
        cwd: base.worktreePath,
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch (err) {
      console.error(
        `aviso: pnpm install falhou na worktree ${opts.workerName} — o worker tentará de novo: ${(err as Error).message}`,
      );
    }
  }

  // Permissões: TERRITORY.txt → settings do claude (cerca executável, não prompt).
  let territory: string[] = [];
  try {
    territory = parseLineList(
      await fs.readFile(path.join(base.worktreePath, slotDirRel, 'TERRITORY.txt'), 'utf-8'),
    );
  } catch {
    /* sem território — worker fica restrito à pasta do slot (cerca mínima) */
  }
  const settings = buildWorkerSettings({
    territory,
    neutralZones: cfg.neutralZones,
    slotDirRel,
    allowNetwork: auto.allowNetwork,
  });

  await fs.mkdir(RUN_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
  // prefixo "_" → readWorkerMetas ignora (não é meta de worker)
  const settingsPath = path.join(RUN_DIR, `_settings-${opts.workerName}.json`);
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

  const logPath = path.join(LOGS_DIR, `${opts.workerName}.log`);
  const logFd = fsSync.openSync(logPath, 'a');

  const args = [
    '-p', base.prompt,
    '--settings', settingsPath,
    '--max-turns', String(auto.maxTurns),
    '--output-format', 'stream-json',
    '--verbose',
  ];
  if (auto.model) args.push('--model', auto.model);

  const child = spawn(auto.command, args, {
    cwd: base.worktreePath,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  fsSync.closeSync(logFd);

  if (child.pid === undefined) {
    throw new Error(`spawn de '${auto.command}' não retornou pid (comando existe no PATH?)`);
  }

  const meta: WorkerMeta = {
    worker: opts.workerName,
    slotId: opts.slotId,
    milestone: opts.milestone,
    branch: base.branch,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    logPath,
    settingsPath,
  };
  await fs.writeFile(metaPath(opts.workerName), JSON.stringify(meta, null, 2));

  return { ...meta, worktreePath: base.worktreePath };
}
