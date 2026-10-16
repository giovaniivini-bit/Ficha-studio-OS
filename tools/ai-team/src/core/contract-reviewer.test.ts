import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewVerdict, REVIEW_SETTINGS, buildReviewPrompt } from './contract-reviewer.ts';

test('parseReviewVerdict: APROVADO no fim -> approved', () => {
  const r = parseReviewVerdict('analisei tudo, estrutura ok.\nAPROVADO');
  assert.equal(r.verdict, 'approved');
  assert.equal(r.reason, '');
});

test('parseReviewVerdict: REPROVADO com motivo -> rejected + reason', () => {
  const r = parseReviewVerdict('Tier 1 falhou.\nREPROVADO: componente duplicado deveria ir pra components/ui');
  assert.equal(r.verdict, 'rejected');
  assert.match(r.reason, /components\/ui/);
});

test('parseReviewVerdict: sem veredito claro -> rejected (fail-safe)', () => {
  const r = parseReviewVerdict('o modelo divagou e nao concluiu');
  assert.equal(r.verdict, 'rejected');
});

test('parseReviewVerdict: APROVADO depois de mencionar REPROVADO no corpo -> approved', () => {
  const r = parseReviewVerdict('nao foi REPROVADO em nenhum tier.\nAPROVADO');
  assert.equal(r.verdict, 'approved');
});

test('REVIEW_SETTINGS nega Edit e Write (read-only)', () => {
  assert.ok(REVIEW_SETTINGS.permissions.deny.includes('Edit'));
  assert.ok(REVIEW_SETTINGS.permissions.deny.includes('Write'));
  assert.ok(REVIEW_SETTINGS.permissions.deny.includes('NotebookEdit'));
});

test('buildReviewPrompt inclui spec, diff e a regra de estrutura nas 2 camadas', () => {
  const p = buildReviewPrompt({
    milestone: 'M1', slotId: 'api-x',
    designSpec: 'SPEC_AQUI', contract: 'CONTRACT_AQUI', sharedContract: 'SHARED_AQUI',
    diff: 'DIFF_AQUI', artifacts: 'ARTIFACTS_AQUI',
  });
  assert.match(p, /SPEC_AQUI/);
  assert.match(p, /DIFF_AQUI/);
  assert.match(p, /SHARED_AQUI/);
  assert.match(p, /componentiza/i);     // tier de estrutura/componentizacao
  assert.match(p, /ADR 004/);           // backend modular
  assert.match(p, /ADR 006/);           // frontend decomposto
  assert.match(p, /APROVADO/);          // instrucao de veredito
  assert.match(p, /REPROVADO/);
});
