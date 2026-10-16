import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  parseLedger,
  serializeRecord,
  countBySignature,
  nextId,
  readLedger,
  appendRecord,
  type LearningRecord,
} from './learn-ledger.ts';

function rec(over: Partial<LearningRecord> = {}): LearningRecord {
  return {
    id: '2026-06-24-001',
    data: '2026-06-24',
    assinatura: 'escrita-sem-authz',
    gatilho: 'bug',
    camada: 'back',
    sintoma: 's',
    causaRaiz: 'c',
    fix: 'f',
    enforcement: null,
    pesquisado: null,
    status: 'captured',
    ...over,
  };
}

test('parseLedger pula linhas vazias e corrompidas', () => {
  const text =
    serializeRecord(rec()) + '\n\nnao-e-json\n' + serializeRecord(rec({ id: '2026-06-24-002' }));
  assert.equal(parseLedger(text).length, 2);
});

test('parseLedger pula JSON válido mas com id/assinatura não-string', () => {
  const text = '{"id":123,"assinatura":"foo"}\n{"id":"ok","assinatura":5}\n' + serializeRecord(rec());
  const recs = parseLedger(text);
  assert.equal(recs.length, 1);
  assert.equal(recs[0]!.id, '2026-06-24-001');
});

test('countBySignature conta só a assinatura dada', () => {
  const recs = [rec(), rec({ id: 'x', assinatura: 'outra' }), rec({ id: 'y' })];
  assert.equal(countBySignature(recs, 'escrita-sem-authz'), 2);
});

test('nextId incrementa o maior do dia com 3 dígitos', () => {
  const recs = [rec({ id: '2026-06-24-001' }), rec({ id: '2026-06-24-003' })];
  assert.equal(nextId(recs, '2026-06-24'), '2026-06-24-004');
  assert.equal(nextId(recs, '2026-06-25'), '2026-06-25-001');
});

test('append + read roundtrip cria diretório que falta', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ledger-'));
  const p = path.join(dir, 'sub', 'ledger.jsonl');
  await appendRecord(p, rec());
  await appendRecord(p, rec({ id: '2026-06-24-002', assinatura: 'outra' }));
  const recs = await readLedger(p);
  assert.equal(recs.length, 2);
  assert.equal(recs[0]!.assinatura, 'escrita-sem-authz');
});

test('readLedger em arquivo ausente = vazio', async () => {
  assert.deepEqual(await readLedger('/nao/existe/x.jsonl'), []);
});
