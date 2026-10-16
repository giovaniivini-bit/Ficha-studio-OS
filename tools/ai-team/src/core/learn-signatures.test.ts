import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  parseSignatures,
  hasSignature,
  renderSignatureLine,
  readSignatures,
  addSignature,
} from './learn-signatures.ts';

test('parseSignatures lê só linhas no formato', () => {
  const text =
    '# titulo\n\n- `escrita-sem-authz` — rota de escrita sem gate\n- ruído\n- `contador-nao-atomico` — read-modify-write\n';
  const sigs = parseSignatures(text);
  assert.equal(sigs.length, 2);
  assert.equal(sigs[0]!.slug, 'escrita-sem-authz');
  assert.equal(sigs[1]!.slug, 'contador-nao-atomico');
});

test('hasSignature', () => {
  const sigs = parseSignatures('- `a` — x\n');
  assert.equal(hasSignature(sigs, 'a'), true);
  assert.equal(hasSignature(sigs, 'b'), false);
});

test('renderSignatureLine formata com crase e travessão', () => {
  assert.equal(
    renderSignatureLine('drift-memory-drizzle', 'duas impls divergem'),
    '- `drift-memory-drizzle` — duas impls divergem',
  );
});

test('addSignature adiciona nova e ignora duplicata', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-'));
  const p = path.join(dir, 'learnings', 'signatures.md');
  assert.equal(await addSignature(p, 'escrita-sem-authz', 'rota sem authz'), true);
  assert.equal(await addSignature(p, 'escrita-sem-authz', 'outra desc'), false);
  const sigs = await readSignatures(p);
  assert.equal(sigs.length, 1);
  assert.equal(sigs[0]!.slug, 'escrita-sem-authz');
});
