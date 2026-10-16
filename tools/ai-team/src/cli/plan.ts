import { isAvailable, scanSlots, unmetDependencies } from '../core/slot-scanner.ts';

const C = { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m' };

export async function plan(milestone?: string): Promise<void> {
  // Scan completo (todos os milestones) pra resolver dependências cross-milestone.
  const all = await scanSlots();
  const scoped = milestone ? all.filter((s) => s.milestone === milestone) : all;
  const available = scoped.filter(isAvailable);

  const ready = available.filter((s) => unmetDependencies(s, all).length === 0);
  const waiting = available.filter((s) => unmetDependencies(s, all).length > 0);

  console.log(
    `${C.bold}slots prontos pra começar${milestone ? ` em ${milestone}` : ''}: ${ready.length}/${scoped.length}${C.reset}\n`,
  );
  for (const s of ready) {
    console.log(`  ${C.green}${s.milestone}/${s.id}${C.reset}`);
  }
  if (ready.length === 0) {
    console.log(`${C.dim}(nenhum slot livre sem dependência pendente)${C.reset}`);
  }

  if (waiting.length > 0) {
    console.log(`\n${C.yellow}aguardando dependências (DEPENDS-ON):${C.reset}`);
    for (const s of waiting) {
      const deps = unmetDependencies(s, all).join(', ');
      console.log(`  ${C.dim}${s.milestone}/${s.id} ← falta: ${deps}${C.reset}`);
    }
  }

  console.log(
    `\n${C.dim}use:${C.reset} ai-team start --slot=<id> --worker=<name>${milestone ? ` --milestone=${milestone}` : ''}`,
  );
}
