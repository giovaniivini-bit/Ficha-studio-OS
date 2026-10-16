import fs from 'node:fs/promises';
import path from 'node:path';
import { SLOTS_DIR } from '../core/paths.ts';
import { scanWorkerBranches } from '../core/branch-scanner.ts';
import { reviewDoneSlot } from '../core/contract-reviewer.ts';

/** Revisa (read-only) todos os slots `done` nas branches de worker. Escreve REVIEW.md nos reprovados. */
export async function reviewCmd(milestone?: string): Promise<void> {
  const branches = (await scanWorkerBranches()).filter(
    (b) =>
      typeof b.status === 'object' &&
      b.status.kind === 'done' &&
      (!milestone || b.milestone === milestone),
  );
  if (branches.length === 0) {
    console.log('nenhum slot done pra revisar.');
    process.exit(0);
  }
  let rejected = 0;
  for (const b of branches) {
    const r = await reviewDoneSlot({ branch: b.branch, milestone: b.milestone, slotId: b.slotId });
    const key = `${b.milestone}/${b.slotId}`;
    if (r.verdict === 'approved') {
      console.log(`[APROVADO] ${key}`);
      continue;
    }
    rejected++;
    console.log(`[REPROVADO] ${key}: ${r.reason}`);
    const reviewPath = path.join(SLOTS_DIR, b.milestone, b.slotId, 'REVIEW.md');
    await fs.mkdir(path.dirname(reviewPath), { recursive: true });
    await fs.writeFile(
      reviewPath,
      `# REVIEW - ${key}\n\nReprovado pelo Gate 2.\n\n## Motivo\n${r.reason}\n\n## Relatorio\n${r.report}\n`,
    );
  }
  console.log(`\n${branches.length} revisado(s), ${rejected} reprovado(s).`);
  process.exit(rejected > 0 ? 1 : 0);
}
