import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTONOMOUS_DEFAULTS, CONFIG_VERSION, parseGates } from './config.ts';
import type { AiTeamConfig } from './config.ts';

test('CONFIG_VERSION subiu pra 4', () => {
  assert.equal(CONFIG_VERSION, 4);
});

test('defaults do autonomous preservados', () => {
  assert.equal(AUTONOMOUS_DEFAULTS.maxWorkers, 4);
});

test('parseGates: sem bloco gates -> contractGate habilitado (back-compat)', () => {
  assert.equal(parseGates({}).contractGate.enabled, true);
  assert.equal(parseGates(undefined).contractGate.enabled, true);
});

test('parseGates: enabled:false explicito e respeitado', () => {
  assert.equal(parseGates({ gates: { contractGate: { enabled: false } } as any }).contractGate.enabled, false);
});

test('parseGates: bloco gates presente mas contractGate ausente -> default true', () => {
  assert.equal(parseGates({ gates: {} as any }).contractGate.enabled, true);
});

test('parseGates: cleanReviewer default habilitado, maxReviewLoops 2', () => {
  const g = parseGates({});
  assert.equal(g.cleanReviewer.enabled, true);
  assert.equal(g.cleanReviewer.maxReviewLoops, 2);
});

test('parseGates: cleanReviewer enabled:false respeitado', () => {
  const g = parseGates({ gates: { cleanReviewer: { enabled: false } } as any });
  assert.equal(g.cleanReviewer.enabled, false);
});
