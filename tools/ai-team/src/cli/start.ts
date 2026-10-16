import { spawnWorker, startWorker } from '../core/worker-runner.ts';
import { scanSlots, isAvailable, unmetDependencies } from '../core/slot-scanner.ts';

const C = { reset: '\x1b[0m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m' };

export interface StartArgs {
  slot: string;
  worker: string;
  milestone?: string;
  force?: boolean;
  /** Modo autônomo: spawna `claude -p` headless em vez de imprimir prompt pro humano. */
  spawn?: boolean;
}

export async function start(args: StartArgs): Promise<void> {
  const slots = await scanSlots(args.milestone);
  const slot = slots.find((s) => s.id === args.slot && (!args.milestone || s.milestone === args.milestone));
  if (!slot) {
    console.error(`slot não encontrado: ${args.slot}${args.milestone ? ` em ${args.milestone}` : ''}`);
    process.exit(1);
  }
  if (!isAvailable(slot) && !args.force) {
    console.error(`slot já não está available: ${slot.milestone}/${slot.id}. Use --force pra ignorar.`);
    process.exit(2);
  }

  // Dependências (DEPENDS-ON.txt): fundação merge antes dos consumidores.
  const unmet = unmetDependencies(slot, slots);
  if (unmet.length > 0 && !args.force) {
    console.error(
      `slot ${slot.milestone}/${slot.id} depende de: ${unmet.join(', ')} (ainda não 'done').\n` +
        `Termine/reconcilie a fundação primeiro, ou use --force se souber o que está fazendo.`,
    );
    process.exit(3);
  }

  if (slot.territory.length === 0) {
    console.log(
      `${C.yellow}aviso: slot sem TERRITORY.txt — zoning não será verificável (pre-commit e reconcile).` +
        ` O Arquiteto deveria declarar o território.${C.reset}`,
    );
  }

  if (args.spawn) {
    const s = await spawnWorker({
      workerName: args.worker,
      slotId: slot.id,
      milestone: slot.milestone,
    });
    console.log(`${C.green}✓${C.reset} worker headless no ar: ${C.cyan}${s.worker}${C.reset} (pid ${s.pid})`);
    console.log(`${C.dim}slot:   ${s.milestone}/${s.slotId}`);
    console.log(`branch: ${s.branch}`);
    console.log(`log:    ${s.logPath}${C.reset}`);
    console.log(`\n${C.dim}acompanhe: ai-team status — ou o loop completo: ai-team run${C.reset}`);
    return;
  }

  const r = await startWorker({
    workerName: args.worker,
    slotId: slot.id,
    milestone: slot.milestone,
  });

  console.log(`${C.green}✓${C.reset} worktree pronta: ${C.cyan}${r.worktreePath}${C.reset}`);
  console.log(`${C.dim}branch: ${r.branch}${C.reset}`);
  if (r.alreadyExists) {
    console.log(`${C.yellow}(worktree já existia — reaproveitando)${C.reset}`);
  }
  console.log();
  console.log(`${C.bold}━━━ próximo passo (humano) ━━━${C.reset}`);
  console.log(`${C.dim}abra um terminal novo e:${C.reset}`);
  console.log();
  console.log(`  cd ${r.worktreePath}`);
  console.log(`  claude`);
  console.log();
  console.log(`${C.dim}cole o prompt abaixo no Claude:${C.reset}`);
  console.log(`${C.dim}─────────────────────────────${C.reset}`);
  console.log(r.prompt);
  console.log(`${C.dim}─────────────────────────────${C.reset}`);
}
