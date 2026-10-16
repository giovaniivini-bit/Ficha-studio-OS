import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decideCapture, capture, type CaptureInput } from './learn-controller.ts';

test('decideCapture: 1ª vez sem retry = propose, sem pesquisa', () => {
  const d = decideCapture(0, false);
  assert.equal(d.recurrence, 1);
  assert.equal(d.needsResearch, false);
  assert.equal(d.enforcement, 'propose');
});

test('decideCapture: 2ª ocorrência = hard + pesquisa', () => {
  const d = decideCapture(1, false);
  assert.equal(d.recurrence, 2);
  assert.equal(d.needsResearch, true);
  assert.equal(d.enforcement, 'hard');
});

test('decideCapture: retry na 1ª vez já é hard', () => {
  const d = decideCapture(0, true);
  assert.equal(d.needsResearch, true);
  assert.equal(d.enforcement, 'hard');
});

test('decideCapture: retry + recorrência não colidem (2ª vez com retry segue hard)', () => {
  const d = decideCapture(1, true);
  assert.equal(d.recurrence, 2);
  assert.equal(d.needsResearch, true);
  assert.equal(d.enforcement, 'hard');
});

async function tmpInput(over: Partial<CaptureInput> = {}): Promise<CaptureInput> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-'));
  return {
    ledgerPath: path.join(dir, 'ledger.jsonl'),
    sigPath: path.join(dir, 'signatures.md'),
    today: '2026-06-24',
    assinatura: 'escrita-sem-authz',
    gatilho: 'bug',
    camada: 'back',
    sintoma: 's',
    causaRaiz: 'c',
    fix: 'f',
    retry: false,
    ...over,
  };
}

test('capture grava a ficha e marca assinatura nova', async () => {
  const { decision, record } = await capture(await tmpInput());
  assert.equal(decision.newSignature, true);
  assert.equal(decision.recurrence, 1);
  assert.equal(record.status, 'captured');
  assert.equal(record.id, '2026-06-24-001');
});

test('capture detecta recorrência na 2ª vez da MESMA assinatura', async () => {
  const input = await tmpInput();
  await capture(input);
  const { decision, record } = await capture(input);
  assert.equal(decision.recurrence, 2);
  assert.equal(decision.needsResearch, true);
  assert.equal(decision.newSignature, false);
  assert.equal(record.id, '2026-06-24-002');
});
