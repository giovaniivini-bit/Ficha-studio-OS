import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHandoffSnapshot, type HandoffSummary } from './handoff-render.ts';

function s(over: Partial<HandoffSummary> = {}): HandoffSummary {
  return {
    total: 0,
    done: 0,
    claimed: 0,
    blocked: 0,
    available: 0,
    workers: [],
    blockedSlots: [],
    escalations: [],
    ...over,
  };
}

test('sem slots → nota de projeto sem ai-team', () => {
  assert.match(renderHandoffSnapshot(s()), /Nenhum slot/);
});

test('com estado → contagens, worktrees, bloqueados e escalações', () => {
  const out = renderHandoffSnapshot(
    s({
      total: 5,
      done: 3,
      claimed: 1,
      blocked: 1,
      available: 0,
      workers: [{ worker: 'auto-x', slotId: 'M1/x' }],
      blockedSlots: [{ id: 'M1/y', reason: 'spec ambígua' }],
      escalations: [{ slot: 'M1/y', reason: 'precisa de decisão' }],
    }),
  );
  assert.match(out, /3 done \/ 1 claimed \/ 1 blocked/);
  assert.match(out, /auto-x → M1\/x/);
  assert.match(out, /M1\/y: spec ambígua/);
  assert.match(out, /precisa de decisão/);
});

test('estado limpo → "nenhuma" em worktrees e escalações', () => {
  const out = renderHandoffSnapshot(s({ total: 2, done: 2 }));
  assert.match(out, /worktrees ativas: nenhuma/);
  assert.match(out, /escalações pendentes: nenhuma/);
  assert.doesNotMatch(out, /BLOQUEADOS/); // sem bloqueados → a seção nem aparece
});
