import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNoZAny, type SlotContract, globsConflict, checkTerritoriesDisjoint, checkDependencies, checkManifesto, checkFrontFlow, verifyContract } from './contract-verifier.ts';

function slot(over: Partial<SlotContract> = {}): SlotContract {
  return { id: 's', milestone: 'M1', designSpec: '', territory: [], dependsOn: [], ...over };
}

test('R1: z.any() na DESIGN-SPEC vira finding critical', () => {
  const findings = checkNoZAny([slot({ id: 'api-x', designSpec: 'const S = z.any()' })]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.rule, 'R1');
  assert.equal(findings[0]!.severity, 'critical');
  assert.equal(findings[0]!.slot, 'api-x');
});

test('R1: spec sem z.any() nao gera finding', () => {
  const findings = checkNoZAny([slot({ designSpec: 'const S = z.object({ id: z.string() })' })]);
  assert.equal(findings.length, 0);
});

test('R6: tela com acao de criar SEM secao Fluxo = critical', () => {
  const f = checkFrontFlow([slot({ id: 'web-funil', territory: ['apps/web/app/(app)/funil/**'], designSpec: 'Botao "Novo lead" no topo. Lista as colunas.' })]);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.rule, 'R6');
  assert.equal(f[0]!.severity, 'critical');
  assert.equal(f[0]!.slot, 'web-funil');
});

test('R6: tela com acao + secao "Fluxo de interacao" = ok', () => {
  const f = checkFrontFlow([slot({ id: 'web-funil', territory: ['apps/web/app/(app)/funil/**'], designSpec: 'Botao "Novo lead". ## Fluxo de interacao: gatilho->modal->mutation->refetch.' })]);
  assert.equal(f.length, 0);
});

test('R6: tela read-only (sem gatilho de mutacao) = ok', () => {
  const f = checkFrontFlow([slot({ id: 'web-dash', territory: ['apps/web/app/(app)/dashboard/**'], designSpec: 'Mostra KPIs e o funil. Somente leitura.' })]);
  assert.equal(f.length, 0);
});

test('R6: slot de backend com "criar" nao e tela = ok', () => {
  const f = checkFrontFlow([slot({ id: 'api-x', territory: ['apps/api/src/modules/x/**'], designSpec: 'Endpoint POST criar contato.' })]);
  assert.equal(f.length, 0);
});

test('globsConflict: identicos conflitam', () => {
  assert.equal(globsConflict('apps/web/**', 'apps/web/**'), true);
});

test('globsConflict: subset conflita', () => {
  assert.equal(globsConflict('apps/web/**', 'apps/web/app/clientes/**'), true);
});

test('globsConflict: irmaos disjuntos nao conflitam', () => {
  assert.equal(globsConflict('apps/web/app/clientes/**', 'apps/web/app/produtos/**'), false);
});

test('R3: dois slots no mesmo territorio = critical', () => {
  const a: SlotContract = { id: 'a', milestone: 'M1', designSpec: '', territory: ['apps/web/app/x/**'], dependsOn: [] };
  const b: SlotContract = { id: 'b', milestone: 'M1', designSpec: '', territory: ['apps/web/app/x/**'], dependsOn: [] };
  const f = checkTerritoriesDisjoint([a, b], []);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.rule, 'R3');
  assert.equal(f[0]!.severity, 'critical');
});

test('R3: territorio em zona neutra = critical', () => {
  const a: SlotContract = { id: 'a', milestone: 'M1', designSpec: '', territory: ['packages/shared/src/dto/x.ts'], dependsOn: [] };
  const f = checkTerritoriesDisjoint([a], ['packages/shared/**']);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.slot, 'a');
  assert.equal(f[0]!.rule, 'R3');
  assert.equal(f[0]!.severity, 'critical');
});

test('R3: territorios disjuntos = sem finding', () => {
  const a: SlotContract = { id: 'a', milestone: 'M1', designSpec: '', territory: ['apps/api/src/modules/x/**'], dependsOn: [] };
  const b: SlotContract = { id: 'b', milestone: 'M1', designSpec: '', territory: ['apps/web/app/y/**'], dependsOn: [] };
  assert.equal(checkTerritoriesDisjoint([a, b], ['packages/shared/**']).length, 0);
});

test('R5: DEPENDS-ON pra slot inexistente = critical', () => {
  const a: SlotContract = { id: 'web-x', milestone: 'M1', designSpec: '', territory: [], dependsOn: ['db-fundacao'] };
  const f = checkDependencies([a], [a]);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.rule, 'R5');
  assert.equal(f[0]!.severity, 'critical');
});

test('R5: DEPENDS-ON resolvido = sem finding', () => {
  const dep: SlotContract = { id: 'db-fundacao', milestone: 'M1', designSpec: '', territory: [], dependsOn: [] };
  const a: SlotContract = { id: 'web-x', milestone: 'M1', designSpec: '', territory: [], dependsOn: ['db-fundacao'] };
  assert.equal(checkDependencies([dep, a], [dep, a]).length, 0);
});

test('R5: dep cross-milestone resolvida no universo nao gera finding', () => {
  const m0: SlotContract = { id: 'foundation', milestone: 'M0', designSpec: '', territory: [], dependsOn: [] };
  const m1: SlotContract = { id: 'web-x', milestone: 'M1', designSpec: '', territory: [], dependsOn: ['M0/foundation'] };
  // verificando so o M1, mas o universo inclui o M0 → resolve, sem R5
  assert.equal(checkDependencies([m1], [m0, m1]).length, 0);
  // sem o M0 no universo → R5 critical (prova que o universo e o que importa)
  const f = checkDependencies([m1], [m1]);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.rule, 'R5');
});

test('R4: sem secao de manifesto = warning', () => {
  const f = checkManifesto('# SHARED-CONTRACT\n## Tipos\n', []);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.rule, 'R4');
  assert.equal(f[0]!.severity, 'warning');
});

test('R4: manifesto so com placeholder = warning', () => {
  const sc = '## Manifesto de Componentizacao\n| Componente | Path |\n|---|---|\n| _(exemplo)_ Foo | x |\n';
  assert.equal(checkManifesto(sc, []).length, 1);
});

test('R4: manifesto populado = sem finding', () => {
  const sc = '## Manifesto de Componentizacao\n| Componente | Path | Slots |\n|---|---|---|\n| StatusPill | components/ui/status-pill.tsx | web-a, web-b |\n';
  assert.equal(checkManifesto(sc, []).length, 0);
});

test('R4: manifesto vazio seguido de outra secao populada ainda avisa', () => {
  const sc = [
    '## Manifesto de Componentizacao',
    '| Componente | Path | Slots |',
    '|---|---|---|',
    '| _(exemplo)_ Foo | x | y |',
    '',
    '## Contratos da fundacao',
    '| Contrato | Path | Assinatura |',
    '|---|---|---|',
    '| fetch base | lib/api/client.ts | apiFetch |',
  ].join('\n');
  const f = checkManifesto(sc, []);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.rule, 'R4');
});

test('verifyContract: critical zera o ok', () => {
  const r = verifyContract({
    slots: [{ id: 'a', milestone: 'M1', designSpec: 'z.any()', territory: [], dependsOn: [] }],
    sharedContract: '## Manifesto de Componentizacao\n| C | P | S |\n|---|---|---|\n| X | y | a |\n',
    neutralZones: [],
  });
  assert.equal(r.ok, false);
  assert.ok(r.findings.some((f) => f.rule === 'R1'));
});

test('verifyContract: so warning mantem ok=true', () => {
  const r = verifyContract({
    slots: [{ id: 'a', milestone: 'M1', designSpec: 'z.object({})', territory: ['apps/api/x/**'], dependsOn: [] }],
    sharedContract: '# sem manifesto',
    neutralZones: [],
  });
  assert.equal(r.ok, true);
  assert.ok(r.findings.some((f) => f.rule === 'R4' && f.severity === 'warning'));
});

test('verifyContract: zero slots = ok sem findings', () => {
  const r = verifyContract({ slots: [], sharedContract: '', neutralZones: [] });
  assert.equal(r.ok, true);
  assert.equal(r.findings.length, 0);
});
