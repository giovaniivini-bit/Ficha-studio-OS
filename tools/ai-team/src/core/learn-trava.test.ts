import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fssync from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { nextBlindagemId, renderBlindagemEntry, renderGrepTrava } from './learn-trava.ts';
import type { ResearchRecord } from './learn-research.ts';

test('nextBlindagemId pega o maior B<n> + 1; B1 se não houver', () => {
  assert.equal(nextBlindagemId('## B1 - x\n## B12 - y\n## B5 - z'), 'B13');
  assert.equal(nextBlindagemId('sem blindagens aqui'), 'B1');
});

test('renderBlindagemEntry monta o cabeçalho e a guarda', () => {
  const r: ResearchRecord = {
    assinatura: 'contador-nao-atomico',
    data: 'd',
    fontes: ['u1'],
    resumo: 'use incremento atômico',
    guardaRecomendada: 'grep read-modify-write',
  };
  const e = renderBlindagemEntry('B13', 'contador-nao-atomico', r);
  assert.match(e, /## B13 - contador-nao-atomico/);
  assert.match(e, /grep read-modify-write/);
  assert.match(e, /Fontes: u1/);
});

test('renderGrepTrava embute pattern, pathFilter e exit 1; lida com aspas na message', () => {
  const s = renderGrepTrava('escrita-sem-authz', 'app\\.post\\(', 'routes.ts', "rota 'sem' authz");
  assert.match(s, /escrita-sem-authz/);
  assert.match(s, /new RegExp\(/);
  assert.match(s, /routes\.ts/);
  assert.match(s, /process\.exit\(1\)/);
  // message com aspas simples não quebra o .mjs (embutida via JSON.stringify)
  assert.match(s, /const MESSAGE = "rota 'sem' authz"/);
});

test('trava gerada EXECUTA: exit 0 em repo limpo, exit 1 quando o padrão aparece', () => {
  const dir = fssync.mkdtempSync(nodePath.join(os.tmpdir(), 'trava-run-'));
  const travaPath = nodePath.join(dir, 'check.mjs');
  fssync.writeFileSync(
    travaPath,
    renderGrepTrava('contador-nao-atomico', 'unreadCount \\+ 1', 'store.ts', 'use incremento atomico'),
  );
  // repo limpo (só o .mjs, que não é escaneado) → exit 0 (não lança)
  execFileSync('node', [travaPath], { cwd: dir, stdio: 'pipe' });
  // arquivo que viola → exit 1
  fssync.mkdirSync(nodePath.join(dir, 'src'));
  fssync.writeFileSync(nodePath.join(dir, 'src', 'store.ts'), 'x.unreadCount + 1\n');
  let exitCode = 0;
  try {
    execFileSync('node', [travaPath], { cwd: dir, stdio: 'pipe' });
  } catch (e) {
    exitCode = (e as { status?: number }).status ?? -1;
  }
  assert.equal(exitCode, 1);
});
