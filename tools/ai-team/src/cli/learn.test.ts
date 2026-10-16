import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug } from './learn.ts';

test('isValidSlug aceita kebab-case minúsculo', () => {
  assert.equal(isValidSlug('escrita-sem-authz'), true);
  assert.equal(isValidSlug('b1'), true);
  assert.equal(isValidSlug('drift-memory-drizzle'), true);
});

test('isValidSlug rejeita maiúsculas, espaço, underscore e vazio', () => {
  assert.equal(isValidSlug('EscritaSemAuthz'), false);
  assert.equal(isValidSlug('escrita sem authz'), false);
  assert.equal(isValidSlug('escrita_sem_authz'), false);
  assert.equal(isValidSlug(''), false);
});
