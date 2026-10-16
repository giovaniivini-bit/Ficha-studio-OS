import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  parseResearch,
  alreadyResearched,
  readResearch,
  appendResearch,
  buildResearchPrompt,
  parseResearchOutput,
  selectForSweep,
  researchSignature,
  type ResearchRecord,
} from './learn-research.ts';
import type { LearningRecord } from './learn-ledger.ts';

function r(over: Partial<ResearchRecord> = {}): ResearchRecord {
  return {
    assinatura: 'escrita-sem-authz',
    data: '2026-06-24',
    fontes: ['u1'],
    resumo: 'x',
    guardaRecomendada: 'g',
    ...over,
  };
}

function lr(assinatura: string): LearningRecord {
  return {
    id: 'x',
    data: '2026-06-24',
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

test('parseResearch pula linhas inválidas/sem assinatura', () => {
  const text =
    JSON.stringify(r()) + '\nlixo\n{"data":"2026-06-24"}\n' + JSON.stringify(r({ assinatura: 'outra' }));
  assert.equal(parseResearch(text).length, 2);
});

test('alreadyResearched', () => {
  const recs = [r()];
  assert.equal(alreadyResearched(recs, 'escrita-sem-authz'), true);
  assert.equal(alreadyResearched(recs, 'nao'), false);
});

test('append + read roundtrip cria diretório', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'res-'));
  const p = path.join(dir, 'learnings', 'research.jsonl');
  await appendResearch(p, r());
  const recs = await readResearch(p);
  assert.equal(recs.length, 1);
  assert.equal(recs[0]!.assinatura, 'escrita-sem-authz');
});

test('buildResearchPrompt cita a assinatura e a causa', () => {
  const p = buildResearchPrompt('contador-nao-atomico', 'read-modify-write');
  assert.match(p, /contador-nao-atomico/);
  assert.match(p, /read-modify-write/);
  assert.match(p, /FONTES:/);
});

test('parseResearchOutput extrai os 3 blocos', () => {
  const out = 'bla\nFONTES:\n- https://a\n- https://b\nRESUMO: usar X sempre.\nGUARDA: grep por Y.';
  const res = parseResearchOutput(out);
  assert.deepEqual(res.fontes, ['https://a', 'https://b']);
  assert.equal(res.resumo, 'usar X sempre.');
  assert.equal(res.guardaRecomendada, 'grep por Y.');
});

test('parseResearchOutput defensivo: blocos ausentes => vazio', () => {
  const res = parseResearchOutput('texto sem formato');
  assert.deepEqual(res.fontes, []);
  assert.equal(res.resumo, '');
  assert.equal(res.guardaRecomendada, '');
});

test('parseResearchOutput é independente de ordem (GUARDA antes de RESUMO)', () => {
  const out = 'FONTES:\n- https://a\nGUARDA: trava por grep.\nRESUMO: usar X.';
  const res = parseResearchOutput(out);
  assert.deepEqual(res.fontes, ['https://a']);
  assert.equal(res.resumo, 'usar X.');
  assert.equal(res.guardaRecomendada, 'trava por grep.');
});

test('selectForSweep: só recorrentes não-pesquisadas, ordenado por recorrência, cortado no budget', () => {
  const records = [lr('a'), lr('a'), lr('a'), lr('b'), lr('b'), lr('c')]; // a=3, b=2, c=1
  const { selected, deferred } = selectForSweep(
    records,
    [{ assinatura: 'b', data: 'd', fontes: [], resumo: '', guardaRecomendada: '' }],
    1,
  );
  assert.deepEqual(selected, ['a']); // c fora (count 1), b fora (já pesquisada), budget=1 pega 'a'
  assert.deepEqual(deferred, []);
});

test('selectForSweep: deferred lista o que passou do budget', () => {
  const records = [lr('a'), lr('a'), lr('b'), lr('b')]; // a=2, b=2
  const { selected, deferred } = selectForSweep(records, [], 1);
  assert.equal(selected.length, 1);
  assert.equal(deferred.length, 1);
});

test('researchSignature: assinatura já pesquisada => deduped, NÃO spawna', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'res2-'));
  const p = path.join(dir, 'research.jsonl');
  await appendResearch(p, r({ assinatura: 'ja-vista' }));
  const res = await researchSignature({
    assinatura: 'ja-vista',
    causaRaiz: 'c',
    researchPath: p,
    today: '2026-06-24',
    command: '/bin/definitivamente-inexistente-xyz',
  });
  assert.equal(res.deduped, true);
  assert.equal(res.record, undefined);
});
