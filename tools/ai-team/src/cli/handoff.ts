// `ai-team handoff` — snapshot read-only do estado do time pro HANDOFF.md (handoff de pausa).
import { scanSlots, isDone, isClaimed, isAvailable } from '../core/slot-scanner.ts';
import { readWorkerMetas } from '../core/worker-runner.ts';
import { listEscalations } from '../core/supervisor.ts';
import { renderHandoffSnapshot, type HandoffSummary } from '../core/handoff-render.ts';
import type { Slot } from '../types.ts';

function isBlocked(s: Slot): boolean {
  return typeof s.status === 'object' && s.status.kind === 'blocked';
}
function blockedReason(s: Slot): string {
  return typeof s.status === 'object' && s.status.kind === 'blocked' ? (s.status.reason ?? '') : '';
}

export async function handoffCmd(milestone?: string): Promise<void> {
  let slots: Slot[] = [];
  try {
    slots = await scanSlots(milestone);
  } catch {
    slots = [];
  }
  const metas = await readWorkerMetas().catch(() => []);
  const escalations = await listEscalations().catch(() => []);
  const summary: HandoffSummary = {
    total: slots.length,
    done: slots.filter(isDone).length,
    claimed: slots.filter(isClaimed).length,
    blocked: slots.filter(isBlocked).length,
    available: slots.filter(isAvailable).length,
    workers: metas.map((m) => ({ worker: m.worker, slotId: `${m.milestone}/${m.slotId}` })),
    blockedSlots: slots
      .filter(isBlocked)
      .map((s) => ({ id: `${s.milestone}/${s.id}`, reason: blockedReason(s) })),
    escalations: escalations.map((e) => ({ slot: e.slot, reason: e.reason })),
  };
  console.log(renderHandoffSnapshot(summary));
}
