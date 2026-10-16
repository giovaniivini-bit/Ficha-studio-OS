// Supervisor do modo autônomo — o watchdog que não existia no modo manual.
// Observa cada worker headless por sinais EXTERNOS (não depende de cooperação do
// agente): processo vivo (pid), último commit na branch, atividade no log, idade.
// Políticas: morto/estagnado/timeout → reap + retry (máx. configurável) → escalação.

import fs from 'node:fs/promises';
import path from 'node:path';
import { RUN_DIR } from './paths.ts';
import { loadConfig } from './config.ts';
import { deleteBranch, runGit, worktreeRemove } from './git.ts';
import { removeWorkerMeta, type WorkerMeta } from './worker-runner.ts';
import type { SlotStatus } from '../types.ts';

export type WorkerHealth =
  | { state: 'running'; idleMin: number }
  | { state: 'finished-done' }
  | { state: 'finished-blocked'; reason: string }
  | { state: 'dead-incomplete' }
  | { state: 'stalled'; idleMin: number }
  | { state: 'timeout'; ageMin: number };

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function lastCommitEpochMs(branch: string): Promise<number | null> {
  try {
    const { stdout } = await runGit(['log', '-1', '--format=%ct', branch]);
    const sec = parseInt(stdout.trim(), 10);
    return Number.isFinite(sec) ? sec * 1000 : null;
  } catch {
    return null;
  }
}

async function fileMtimeMs(p: string): Promise<number | null> {
  try {
    return (await fs.stat(p)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Diagnóstico de um worker. `branchStatus` vem do scanWorkerBranches do chamador
 * (estado commitado na branch é o contrato de saída do worker).
 */
export async function checkWorker(
  meta: WorkerMeta,
  branchStatus: SlotStatus | null,
): Promise<WorkerHealth> {
  if (branchStatus && typeof branchStatus === 'object') {
    if (branchStatus.kind === 'done') return { state: 'finished-done' };
    if (branchStatus.kind === 'blocked') {
      return { state: 'finished-blocked', reason: branchStatus.reason ?? 'sem-motivo' };
    }
  }

  const { autonomous: auto } = loadConfig();
  const now = Date.now();
  const ageMin = (now - Date.parse(meta.startedAt)) / 60_000;

  if (!pidAlive(meta.pid)) return { state: 'dead-incomplete' };
  if (ageMin > auto.slotTimeoutMin) return { state: 'timeout', ageMin };

  const commitMs = await lastCommitEpochMs(meta.branch);
  const logMs = await fileMtimeMs(meta.logPath);
  const lastActivity = Math.max(commitMs ?? 0, logMs ?? 0, Date.parse(meta.startedAt));
  const idleMin = (now - lastActivity) / 60_000;
  if (idleMin > auto.stallTimeoutMin) return { state: 'stalled', idleMin };

  return { state: 'running', idleMin };
}

/**
 * Reap: mata o processo (se vivo), remove worktree e meta. `dropBranch=true` apaga
 * também a branch — o claim vive SÓ na branch, então o slot volta a `available` na
 * main automaticamente (re-despacho idempotente, lição do protocolo).
 */
export async function reapWorker(meta: WorkerMeta, opts: { dropBranch: boolean }): Promise<void> {
  if (pidAlive(meta.pid)) {
    try {
      process.kill(meta.pid);
    } catch {
      /* morreu entre o check e o kill */
    }
  }
  try {
    await worktreeRemove(meta.worker);
  } catch {
    /* worktree já não existe */
  }
  if (opts.dropBranch) {
    try {
      await deleteBranch(meta.branch, true);
    } catch {
      /* branch já não existe */
    }
  }
  await removeWorkerMeta(meta.worker);
}

// ───────────── contadores persistentes (retries / triages / escalações) ─────────────
// Arquivos com prefixo "_" pra não colidirem com as metas de worker (<worker>.json).

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(RUN_DIR, file), 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(RUN_DIR, { recursive: true });
  await fs.writeFile(path.join(RUN_DIR, file), JSON.stringify(value, null, 2));
}

export async function bumpCounter(file: string, key: string): Promise<number> {
  const map = await readJson<Record<string, number>>(file, {});
  const next = (map[key] ?? 0) + 1;
  map[key] = next;
  await writeJson(file, map);
  return next;
}

export async function getCounter(file: string, key: string): Promise<number> {
  const map = await readJson<Record<string, number>>(file, {});
  return map[key] ?? 0;
}

export const RETRIES_FILE = '_retries.json';
export const TRIAGES_FILE = '_triages.json';
export const REVIEWS_FILE = '_reviews.json';

export interface Escalation {
  slot: string; // "<milestone>/<slotId>"
  reason: string;
  at: string;
}

export async function escalate(slot: string, reason: string): Promise<void> {
  const list = await readJson<Escalation[]>('_escalated.json', []);
  if (!list.some((e) => e.slot === slot)) {
    list.push({ slot, reason, at: new Date().toISOString() });
    await writeJson('_escalated.json', list);
  }
}

export async function listEscalations(): Promise<Escalation[]> {
  return readJson<Escalation[]>('_escalated.json', []);
}

/** Lê as últimas linhas do log do worker (pro dashboard live) sem carregar o arquivo todo. */
export async function tailLogLine(logPath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(logPath);
    const size = stat.size;
    if (size === 0) return null;
    const fh = await fs.open(logPath, 'r');
    try {
      const len = Math.min(8192, size);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, size - len);
      const lines = buf.toString('utf-8').split('\n').map((l) => l.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!;
        // stream-json: tenta extrair algo legível; senão, a linha crua truncada.
        try {
          const obj = JSON.parse(line) as { type?: string; message?: { content?: Array<{ type?: string; text?: string; name?: string }> } };
          if (obj.type === 'assistant' && obj.message?.content) {
            for (const c of obj.message.content) {
              if (c.type === 'text' && c.text) return c.text.replace(/\s+/g, ' ').slice(0, 100);
              if (c.type === 'tool_use' && c.name) return `[tool] ${c.name}`;
            }
          }
          if (obj.type === 'result') return '[result] sessão encerrada';
          continue; // linha json sem nada legível — tenta a anterior
        } catch {
          return line.slice(0, 100);
        }
      }
      return null;
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}
