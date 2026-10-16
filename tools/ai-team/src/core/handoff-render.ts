// Snapshot determinístico do estado do time (ai-team) pro handoff de pausa. Função pura:
// recebe os números/listas, devolve o bloco markdown "Estado do time". Read-only.

export interface HandoffSummary {
  total: number;
  done: number;
  claimed: number;
  blocked: number;
  available: number;
  workers: { worker: string; slotId: string }[];
  blockedSlots: { id: string; reason: string }[];
  escalations: { slot: string; reason: string }[];
}

/** Bloco markdown "Estado do time" pro HANDOFF.md. Sem slots → nota curta. */
export function renderHandoffSnapshot(s: HandoffSummary): string {
  if (s.total === 0) {
    return `## Estado do time (ai-team)\n\n_Nenhum slot — projeto sem ai-team ou milestone vazio._\n`;
  }
  const lines: string[] = [`## Estado do time (ai-team)\n`];
  lines.push(
    `- slots: ${s.done} done / ${s.claimed} claimed / ${s.blocked} blocked / ${s.available} available (de ${s.total})`,
  );
  if (s.workers.length) {
    lines.push(`- worktrees ativas (${s.workers.length}):`);
    for (const w of s.workers) lines.push(`  - ${w.worker} → ${w.slotId}`);
  } else {
    lines.push(`- worktrees ativas: nenhuma`);
  }
  if (s.blockedSlots.length) {
    lines.push(`- slots BLOQUEADOS:`);
    for (const b of s.blockedSlots) lines.push(`  - ${b.id}: ${b.reason || '(sem motivo)'}`);
  }
  if (s.escalations.length) {
    lines.push(`- escalações pendentes (precisam de você):`);
    for (const e of s.escalations) lines.push(`  - ${e.slot}: ${e.reason}`);
  } else {
    lines.push(`- escalações pendentes: nenhuma`);
  }
  return lines.join('\n') + '\n';
}
