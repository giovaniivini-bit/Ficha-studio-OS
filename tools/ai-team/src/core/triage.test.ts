import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySlotDomain, domainPersona } from './triage.ts';

test('classifySlotDomain: territorio em apps/web = front', () => {
  assert.equal(classifySlotDomain(['apps/web/app/clientes/**']), 'front');
});

test('classifySlotDomain: apps/api = back', () => {
  assert.equal(classifySlotDomain(['apps/api/src/modules/clients/**']), 'back');
});

test('classifySlotDomain: packages/core|db|adapter = back', () => {
  assert.equal(classifySlotDomain(['packages/core/src/billing/**']), 'back');
  assert.equal(classifySlotDomain(['packages/db/**']), 'back');
  assert.equal(classifySlotDomain(['packages/email/**']), 'back');
});

test('classifySlotDomain: territorio vazio = back (default)', () => {
  assert.equal(classifySlotDomain([]), 'back');
});

test('domainPersona: front menciona ADR 006; back menciona ADR 004', () => {
  assert.match(domainPersona('front'), /ADR 006/);
  assert.match(domainPersona('back'), /ADR 004/);
});
