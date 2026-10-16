import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  parsePromoted,
  isPromoted,
  readPromoted,
  appendPromoted,
  selectForPromotion,
  renderPromotionDoc,
  type PromotedRecord,
} from './learn-promote.ts';
import type { LearningRecord } from './learn-ledger.ts';
import type { ResearchRecord } from './learn-research.ts';

function lr(assinatura: string): LearningRecord {
  return {
    id: 'x',
    data: 'd',
    assinatura,
    gatilho: 'bug',
    camada: 'back',
    sintoma: 's',
    causaRaiz: 'c',
    fix: 'f',
    enforcement: null,
    pesquisado: null,
    status: 'captured',
  };
}
function rr(assinatura: string): ResearchRecord {
  return { assinatura, data: 'd', fontes: ['u'], resumo: 'r', guardaRecomendada: 'g' };
}

test('selectForPromotion: recorrente + pesquisada + não-promovida', () => {
  const ledger = [lr('a'), lr('a'), lr('b'), lr('c'), lr('c')]; // a=2, b=1, c=2
  const research = [rr('a'), rr('c')];
  const promoted: PromotedRecord[] = [{ assinatura: 'c', data: 'd' }];
  const cands = selectForPromotion(ledger, research, promoted);
  assert.deepEqual(
    cands.map((x) => x.assinatura),
    ['a'],
  ); // b sem recorrência, c já promovida
  assert.equal(cands[0]!.recurrence, 2);
});

test('selectForPromotion: recorrente mas NÃO pesquisada fica fora', () => {
  const cands = selectForPromotion([lr('a'), lr('a')], [], []);
  assert.equal(cands.length, 0);
});

test('renderPromotionDoc lista as candidatas; vazio quando não há', () => {
  assert.match(renderPromotionDoc([]), /Nenhuma candidata/);
  const doc = renderPromotionDoc([{ assinatura: 'a', recurrence: 3, research: rr('a') }]);
  assert.match(doc, /## a \(recorrência 3x\)/);
  assert.match(doc, /Guarda recomendada: g/);
});

test('promoted store roundtrip + dedup', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prom-'));
  const p = path.join(dir, 'learnings', 'promoted.jsonl');
  await appendPromoted(p, { assinatura: 'a', data: 'd', bId: 'B13' });
  const recs = await readPromoted(p);
  assert.equal(recs.length, 1);
  assert.equal(isPromoted(recs, 'a'), true);
  assert.equal(isPromoted(recs, 'z'), false);
  assert.equal(parsePromoted('lixo\n{"assinatura":"x","data":"d"}').length, 1);
});
