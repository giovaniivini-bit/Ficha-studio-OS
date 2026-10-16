// ai-team run — o ORQUESTRADOR do modo autônomo. Substitui o humano no caminho do
// despacho: spawna workers headless (claude -p) por slot, vigia (watchdog), reconcilia
// quando done aparece, faz triage de blocked (Arquiteto one-shot) e re-despacha — em
// loop até o milestone fechar. O que permanece humano: HTC e escalações de produto.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../core/config.ts';
import { loadContractInput } from '../core/contract-loader.ts';
import { verifyContract } from '../core/contract-verifier.ts';
import { LOGS_DIR, RUN_DIR, MONOREPO_ROOT } from '../core/paths.ts';
import { currentBranch, branchExists, deleteBranch } from '../core/git.ts';
import { reviewDoneSlot } from '../core/contract-reviewer.ts';
import { scanSlots, isAvailable, isDone, unmetDependencies, statusLabel } from '../core/slot-scanner.ts';
import { scanWorkerBranches, indexByKey } from '../core/branch-scanner.ts';
import { reconcile } from '../core/reconciler.ts';
import { spawnWorker, readWorkerMetas, removeWorkerMeta, type WorkerMeta } from '../core/worker-runner.ts';
import {
  checkWorker,
  pidAlive,
  reapWorker,
  escalate,
  listEscalations,
  bumpCounter,
  getCounter,
  tailLogLine,
  RETRIES_FILE,
  TRIAGES_FILE,
  REVIEWS_FILE,
} from '../core/supervisor.ts';
import { triageBlockedSlot } from '../core/triage.ts';
import { readLedger, LEDGER_PATH } from '../core/learn-ledger.ts';
import { readResearch, RESEARCH_PATH, selectForSweep } from '../core/learn-research.ts';
import { learnSweep } from './learn.ts';
import type { Slot } from '../types.ts';

const exec = promisify(execFile);

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

export interface RunOpts {
  milestone?: string;
  workers?: number;
  pollSeconds?: number;
  dryRun?: boolean;
  /** Sem re-render de tela (CI/log): só eventos em linha. */
  plain?: boolean;
  skipContractGate?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slotKey(s: { milestone: string; id?: string; slotId?: string }): string {
  return `${s.milestone}/${'id' in s && s.id ? s.id : (s as { slotId: string }).slotId}`;
}

function workerNameFor(slotId: string): string {
  return `auto-${slotId.replace(/[^a-zA-Z0-9._-]/g, '-')}`.slice(0, 60);
}

/**
 * Antes do HTC: pesquisa em lote as assinaturas recorrentes pendentes (Loop de Aprendizado),
 * pra alimentar a promoção. Só dispara com rede consentida (auto.allowNetwork); senão, avisa.
 * Best-effort: nunca derruba o fechamento do run.
 */
async function runLearningSweep(allowNetwork: boolean): Promise<void> {
  try {
    const [ledger, research] = await Promise.all([
      readLedger(LEDGER_PATH),
      readResearch(RESEARCH_PATH),
    ]);
    const { selected } = selectForSweep(ledger, research, 5);
    if (selected.length === 0) return;
    if (!allowNetwork) {
      console.log(
        `\n${C.dim}aprendizado: ${selected.length} assinatura(s) recorrente(s) pendente(s) de pesquisa — rode \`ai-team learn sweep\` (precisa de rede).${C.reset}`,
      );
      return;
    }
    console.log(
      `\n${C.cyan}aprendizado: pesquisando ${selected.length} assinatura(s) recorrente(s) antes do HTC...${C.reset}`,
    );
    await learnSweep({ retry: false });
  } catch (err) {
    console.log(
      `${C.dim}aprendizado: sweep pulado (${err instanceof Error ? err.message.slice(0, 80) : 'erro'}).${C.reset}`,
    );
  }
}

async function writeReviewFile(milestone: string, slotId: string, reason: string, report: string): Promise<void> {
  const rel = `specs/slots/${milestone}/${slotId}/REVIEW.md`;
  const abs = path.join(MONOREPO_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true }); // defensivo (igual ao comando review)
  await fs.writeFile(abs, `# REVIEW - ${milestone}/${slotId}\n\nReprovado pelo Gate 2 - releia antes de reimplementar.\n\n## Motivo\n${reason}\n\n## Relatorio\n${report}\n`);
  try {
    await exec('git', ['add', rel], { cwd: MONOREPO_ROOT });
    await exec('git', ['commit', '-m', `review(${slotId}): feedback do Gate 2`], { cwd: MONOREPO_ROOT });
  } catch {
    /* commit no-op (REVIEW.md identico) ou hiccup de git — o arquivo ja foi escrito, segue */
  }
}

/** Ordena o despacho: fundação primeiro (mais dependentes), depois menos dependências. */
function dispatchOrder(ready: Slot[], all: Slot[]): Slot[] {
  const dependents = new Map<string, number>();
  for (const s of all) {
    for (const dep of s.dependsOn) {
      const key = dep.includes('/') ? dep : `${s.milestone}/${dep}`;
      dependents.set(key, (dependents.get(key) ?? 0) + 1);
    }
  }
  return [...ready].sort((a, b) => {
    const da = dependents.get(slotKey(a)) ?? 0;
    const db = dependents.get(slotKey(b)) ?? 0;
    if (da !== db) return db - da;
    if (a.dependsOn.length !== b.dependsOn.length) return a.dependsOn.length - b.dependsOn.length;
    return a.id.localeCompare(b.id);
  });
}

interface Ctx {
  events: string[];
  plain: boolean;
}

function event(ctx: Ctx, msg: string): void {
  const stamped = `${new Date().toISOString().slice(11, 19)} ${msg}`;
  ctx.events.push(stamped);
  if (ctx.events.length > 60) ctx.events.shift();
  if (ctx.plain) console.log(stamped);
}

const LOCK_FILE = '_scheduler.lock';

/**
 * Lock de scheduler: DOIS `ai-team run` no mesmo repo = despacho duplicado e estado
 * poluído (incidente real do E2E: zumbi de rodada anterior re-executou slot já
 * integrado). Lock com pid: stale (pid morto) é assumido automaticamente.
 */
async function acquireSchedulerLock(): Promise<() => Promise<void>> {
  const lockPath = path.join(RUN_DIR, LOCK_FILE);
  try {
    const existing = JSON.parse(await fs.readFile(lockPath, 'utf-8')) as { pid?: number };
    if (typeof existing.pid === 'number' && pidAlive(existing.pid)) {
      throw new Error(
        `já existe um ai-team run rodando neste repo (pid ${existing.pid}). ` +
          `Dois schedulers = despacho duplicado. Pare o outro (kill ${existing.pid}) ou aguarde.`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('já existe')) throw err;
    /* sem lock ou lock corrompido/stale — assume */
  }
  await fs.writeFile(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return async () => {
    try {
      await fs.unlink(lockPath);
    } catch {
      /* já removido */
    }
  };
}

async function preflight(opts: RunOpts): Promise<void> {
  const cur = await currentBranch();
  if (cur !== 'main') {
    throw new Error(`ai-team run exige estar na main; está em '${cur}'.`);
  }
  const { autonomous: auto } = loadConfig();
  if (!opts.dryRun) {
    try {
      await exec(auto.command, ['--version'], { timeout: 30_000 });
    } catch {
      throw new Error(
        `comando '${auto.command}' não respondeu a --version. O modo autônomo precisa do ` +
          `Claude Code CLI logado (ou configure autonomous.command no .ai-team.json).`,
      );
    }
  }
  await fs.mkdir(RUN_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

// ─────────────────────────────── dashboard live (Fase 3) ───────────────────────────────

async function render(opts: {
  milestone?: string | undefined;
  tick: number;
  startedAt: number;
  maxWorkers: number;
  slots: Slot[];
  metas: WorkerMeta[];
  ready: Slot[];
  waiting: Array<{ slot: Slot; missing: string[] }>;
  events: string[];
  backoffUntil: number;
}): Promise<void> {
  const lines: string[] = [];
  const elapsedMin = Math.floor((Date.now() - opts.startedAt) / 60_000);
  lines.push(
    `${C.bold}━━━ ai-team run ${opts.milestone ?? '(todos os milestones)'} ━━━${C.reset} ` +
      `${C.dim}tick ${opts.tick} · ${elapsedMin}min · workers ${opts.metas.length}/${opts.maxWorkers}` +
      `${opts.backoffUntil > Date.now() ? ` · ${C.yellow}BACKOFF${C.dim}` : ''}${C.reset}`,
  );
  lines.push('');

  // slots por status
  const counts = new Map<string, number>();
  for (const s of opts.slots) {
    const label = statusLabel(s).split(':')[0]!;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [label, n] of [...counts.entries()].sort()) {
    const color = label === 'done' ? C.green : label === 'blocked' ? C.red : label === 'claimed' ? C.cyan : C.dim;
    parts.push(`${color}${label}:${n}${C.reset}`);
  }
  lines.push(`slots  ${parts.join('  ')}`);

  // workers ativos com tail do log
  if (opts.metas.length > 0) {
    lines.push('');
    for (const m of opts.metas) {
      const ageMin = Math.floor((Date.now() - Date.parse(m.startedAt)) / 60_000);
      const tail = (await tailLogLine(m.logPath)) ?? '…';
      lines.push(`  ${C.cyan}● ${m.worker}${C.reset} ${C.dim}(${m.milestone}/${m.slotId}, ${ageMin}min)${C.reset}`);
      lines.push(`    ${C.dim}${tail}${C.reset}`);
    }
  }

  // fila
  if (opts.ready.length > 0) {
    lines.push('');
    lines.push(`${C.dim}fila: ${opts.ready.map((s) => s.id).join(', ')}${C.reset}`);
  }
  if (opts.waiting.length > 0) {
    lines.push(
      `${C.dim}aguardando deps: ${opts.waiting.map((w) => `${w.slot.id}←[${w.missing.join(',')}]`).join('  ')}${C.reset}`,
    );
  }

  // eventos recentes
  const recent = opts.events.slice(-8);
  if (recent.length > 0) {
    lines.push('');
    lines.push(`${C.bold}eventos${C.reset}`);
    for (const e of recent) lines.push(`  ${C.dim}${e}${C.reset}`);
  }

  console.clear();
  console.log(lines.join('\n'));
}

// ────────────────────────────────────── loop ──────────────────────────────────────

export async function run(opts: RunOpts = {}): Promise<void> {
  const cfg = loadConfig();
  const auto = cfg.autonomous;
  const maxWorkers = opts.workers ?? auto.maxWorkers;
  const pollMs = (opts.pollSeconds ?? 15) * 1000;
  const ctx: Ctx = { events: [], plain: opts.plain === true || opts.dryRun === true };

  await preflight(opts);
  const releaseLock = opts.dryRun ? null : await acquireSchedulerLock();

  try {
    await runLoop(opts, { maxWorkers, pollMs, ctx });
  } finally {
    if (releaseLock) await releaseLock();
  }
}

async function runLoop(
  opts: RunOpts,
  cfgRun: { maxWorkers: number; pollMs: number; ctx: Ctx },
): Promise<void> {
  const cfg = loadConfig();
  const { autonomous: auto } = cfg;
  const { maxWorkers, pollMs, ctx } = cfgRun;

  // GATE 1 — verificador de contrato. Roda uma vez, antes de qualquer dispatch.
  // Critical bloqueia o fan-out: o Arquiteto precisa re-specar (read-only, nao corrige aqui).
  if (cfg.gates.contractGate.enabled && !opts.skipContractGate && !opts.dryRun) {
    const verification = verifyContract(await loadContractInput(opts.milestone));
    for (const f of verification.findings) {
      const tag = f.severity === 'critical' ? `${C.red}CRITICAL${C.reset}` : `${C.yellow}aviso${C.reset}`;
      event(ctx, `Gate 1 [${tag}] ${f.rule}${f.slot ? ` ${f.slot}` : ''}: ${f.message}`);
    }
    if (!verification.ok) {
      event(ctx, `${C.red}⛔ Gate 1 reprovou o contrato - fan-out bloqueado. Arquiteto deve re-specar (ou rode com --skip-contract-gate).${C.reset}`);
      return;
    }
  }

  let backoffUntil = 0;
  let quickFails = 0;
  const startedAt = Date.now();
  const hardStopAt = startedAt + 12 * 60 * 60_000; // trava de segurança: 12h

  for (let tick = 1; Date.now() < hardStopAt; tick++) {
    // ── estado
    let allSlots = await scanSlots(); // todos os milestones (deps cross-milestone)
    let slots = opts.milestone ? allSlots.filter((s) => s.milestone === opts.milestone) : allSlots;
    let branches = await scanWorkerBranches();
    let branchByKey = indexByKey(branches);
    let metas = await readWorkerMetas();

    // ── colheita: branches done → reconcile (libera a próxima wave)
    const doneBranches = branches.filter(
      (b) =>
        typeof b.status === 'object' &&
        b.status.kind === 'done' &&
        (!opts.milestone || b.milestone === opts.milestone),
    );
    if (doneBranches.length > 0 && !opts.dryRun) {
      event(ctx, `⤵ ${doneBranches.length} slot(s) done — reconciliando`);

      let shouldReconcile = true;

      // ── GATE 2: revisa cada done (contexto limpo) antes de reconciliar.
      if (cfg.gates.cleanReviewer.enabled) {
        let approved = 0;
        for (const b of doneBranches) {
          const key = `${b.milestone}/${b.slotId}`;
          const review = await reviewDoneSlot({ branch: b.branch, milestone: b.milestone, slotId: b.slotId });
          if (review.verdict === 'approved') {
            approved++;
            event(ctx, `✓ Gate 2: ${key} aprovado`);
            continue;
          }
          const reviews = await bumpCounter(REVIEWS_FILE, key);
          await writeReviewFile(b.milestone, b.slotId, review.reason, review.report);
          const meta = metas.find((m) => m.milestone === b.milestone && m.slotId === b.slotId);
          if (meta) await reapWorker(meta, { dropBranch: true });
          else {
            try {
              await deleteBranch(b.branch, true);
            } catch {
              /* branch ja sumiu ou git hiccup - nao derruba o tick */
            }
          }
          if (reviews > cfg.gates.cleanReviewer.maxReviewLoops) {
            await escalate(key, `Gate 2 reprovou ${reviews}x: ${review.reason}`);
            event(ctx, `🙋 Gate 2: ${key} reprovado ${reviews}x — ESCALADO (ver REVIEW.md)`);
          } else {
            event(ctx, `↻ Gate 2: ${key} reprovado — re-despacho com feedback (${reviews}/${cfg.gates.cleanReviewer.maxReviewLoops})`);
          }
        }
        // rejeitados foram dropados; re-scan pro reconcile so ver os aprovados.
        branches = await scanWorkerBranches();
        metas = await readWorkerMetas();
        if (approved === 0) {
          event(ctx, '⤵ Gate 2: nenhum slot aprovado neste tick — pulando reconcile');
          shouldReconcile = false;
        }
      }

      if (shouldReconcile) {
        try {
          const r = await reconcile({ cleanup: true });
          event(
            ctx,
            r.smokeOk
              ? `✓ reconcile: ${r.mergedSlots.length} merged, smoke verde`
              : `✗ reconcile: smoke FALHOU — ver specs/RECONCILE-REPORT.md`,
          );
          if (!r.smokeOk) {
            event(ctx, '⏸ parando: smoke cruzado quebrado precisa de correção (slot de gap)');
            break;
          }
          for (const z of r.zoning) {
            if (z.check.violations.length > 0) {
              event(ctx, `🚨 zoning violado em ${z.slot} — revisar no review estrutural`);
            }
          }
        } catch (err) {
          event(ctx, `✗ reconcile falhou: ${(err as Error).message}`);
          break;
        }
        // metas de workers cuja branch já foi mergeada+limpa
        for (const m of metas) {
          if (!(await branchExists(m.branch))) await removeWorkerMeta(m.worker);
        }
        // re-scan COMPLETO: o reconcile mudou a main (slots done) — despachar com o
        // scan velho re-despacharia slot já integrado (bug pego no E2E).
        allSlots = await scanSlots();
        slots = opts.milestone ? allSlots.filter((s) => s.milestone === opts.milestone) : allSlots;
        branches = await scanWorkerBranches();
        branchByKey = indexByKey(branches);
        metas = await readWorkerMetas();
        quickFails = 0; // sucesso real reseta o backoff
      }
    }

    // ── supervisão (watchdog)
    for (const m of metas) {
      const bStatus = branchByKey.get(`${m.milestone}/${m.slotId}`)?.status ?? null;
      const health = await checkWorker(m, bStatus);
      const key = `${m.milestone}/${m.slotId}`;

      switch (health.state) {
        case 'running':
        case 'finished-done': // colhido no próximo tick pelo reconcile
          break;

        case 'finished-blocked': {
          const triages = await getCounter(TRIAGES_FILE, key);
          if (auto.triage && triages < 1 && !opts.dryRun) {
            event(ctx, `🔧 ${key} blocked:${health.reason} — triage com Arquiteto one-shot`);
            await bumpCounter(TRIAGES_FILE, key);
            const t = await triageBlockedSlot({
              branch: m.branch,
              milestone: m.milestone,
              slotId: m.slotId,
              reason: health.reason,
            });
            if (t.verdict === 'resolved') {
              await reapWorker(m, { dropBranch: true }); // spec corrigida → re-despacho limpo
              event(ctx, `✓ ${key}: spec corrigida pelo Arquiteto — slot volta pra fila`);
            } else {
              await escalate(key, `blocked:${health.reason} — ${t.summary}`);
              await reapWorker(m, { dropBranch: false }); // preserva branch pro humano
              event(ctx, `🙋 ${key}: ESCALADO pro humano (${health.reason})`);
            }
          } else {
            await escalate(key, `blocked:${health.reason}`);
            await reapWorker(m, { dropBranch: false });
            event(ctx, `🙋 ${key}: blocked escalado pro humano (${health.reason})`);
          }
          break;
        }

        case 'dead-incomplete':
        case 'stalled':
        case 'timeout': {
          const ageMin = (Date.now() - Date.parse(m.startedAt)) / 60_000;
          if (health.state === 'dead-incomplete' && ageMin < 2) {
            // morte precoce repetida ≈ rate limit/erro de ambiente → backoff exponencial
            quickFails++;
            backoffUntil = Date.now() + Math.min(15_000 * 2 ** quickFails, 10 * 60_000);
            event(ctx, `⚠ ${key}: worker morreu em <2min (${quickFails}x) — backoff ativado`);
          }
          const retries = await bumpCounter(RETRIES_FILE, key);
          await reapWorker(m, { dropBranch: true });
          if (retries > auto.maxRetries) {
            await escalate(key, `${health.state} após ${retries} tentativas`);
            event(ctx, `🙋 ${key}: ${health.state} ${retries}x — ESCALADO pro humano`);
          } else {
            event(ctx, `↻ ${key}: ${health.state} — re-despacho (${retries}/${auto.maxRetries})`);
          }
          break;
        }
      }
    }
    branches = await scanWorkerBranches();
    metas = await readWorkerMetas();

    // ── despacho
    const escalated = new Set((await listEscalations()).map((e) => e.slot));
    const claimedKeys = new Set(branches.map((b) => `${b.milestone}/${b.slotId}`));
    const candidates = slots.filter(
      (s) => isAvailable(s) && !claimedKeys.has(slotKey(s)) && !escalated.has(slotKey(s)),
    );
    const ready = dispatchOrder(
      candidates.filter((s) => unmetDependencies(s, allSlots).length === 0),
      allSlots,
    );
    const waiting = candidates
      .filter((s) => unmetDependencies(s, allSlots).length > 0)
      .map((s) => ({ slot: s, missing: unmetDependencies(s, allSlots) }));

    if (opts.dryRun) {
      console.log(`${C.bold}dry-run — plano de despacho${C.reset}\n`);
      console.log(`workers: até ${maxWorkers} em paralelo (comando: ${auto.command})\n`);
      ready.forEach((s, i) =>
        console.log(`  ${i < maxWorkers ? C.green + '▶' : C.dim + '·'} ${slotKey(s)} → worker ${workerNameFor(s.id)}${C.reset}`),
      );
      for (const w of waiting) {
        console.log(`  ${C.yellow}⏳${C.reset} ${slotKey(w.slot)} ${C.dim}← aguarda ${w.missing.join(', ')}${C.reset}`);
      }
      if (escalated.size > 0) console.log(`  ${C.red}🙋 escalados: ${[...escalated].join(', ')}${C.reset}`);
      return;
    }

    if (Date.now() >= backoffUntil) {
      const slotsLivres = Math.max(0, (backoffUntil > 0 && quickFails > 0 ? 1 : maxWorkers) - metas.length);
      for (const s of ready.slice(0, slotsLivres)) {
        const worker = workerNameFor(s.id);
        try {
          const spawned = await spawnWorker({ workerName: worker, slotId: s.id, milestone: s.milestone });
          event(ctx, `▶ ${slotKey(s)} despachado → ${worker} (pid ${spawned.pid})`);
        } catch (err) {
          event(ctx, `✗ spawn de ${slotKey(s)} falhou: ${(err as Error).message}`);
          backoffUntil = Date.now() + 60_000;
          break;
        }
      }
      metas = await readWorkerMetas();
    }

    // ── término
    const activeClaims = branches.filter(
      (b) =>
        (!opts.milestone || b.milestone === opts.milestone) &&
        typeof b.status === 'object' &&
        (b.status.kind === 'claimed' || b.status.kind === 'done'),
    );
    if (ready.length === 0 && waiting.length === 0 && metas.length === 0 && activeClaims.length === 0) {
      const finalSlots = await scanSlots(opts.milestone);
      const done = finalSlots.filter(isDone).length;
      const esc = await listEscalations();
      console.log(`\n${C.bold}━━━ ai-team run encerrado ━━━${C.reset}`);
      console.log(`${C.green}✓ ${done}/${finalSlots.length} slots integrados na main${C.reset}`);
      if (esc.length > 0) {
        console.log(`\n${C.yellow}🙋 escalações pendentes (precisam de você):${C.reset}`);
        for (const e of esc) console.log(`  - ${e.slot}: ${e.reason}`);
      }
      await runLearningSweep(auto.allowNetwork);
      console.log(`\n${C.dim}próximos passos: specs/RECONCILE-REPORT.md → review estrutural`);
      console.log(`(skill review-before-merge) → HTC. O milestone NÃO está "entregue" sem o seu teste.${C.reset}`);
      return;
    }

    if (!ctx.plain) {
      await render({
        milestone: opts.milestone,
        tick,
        startedAt,
        maxWorkers,
        slots,
        metas,
        ready,
        waiting,
        events: ctx.events,
        backoffUntil,
      });
    }

    await sleep(pollMs);
  }

  console.log(`${C.yellow}trava de segurança (12h) atingida — encerrando. Estado preservado; rode de novo pra continuar.${C.reset}`);
}
