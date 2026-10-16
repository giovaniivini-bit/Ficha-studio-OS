// Verificador de contrato (Gate 1) — funcoes PURAS, sem I/O.
// Rubrica checavel da wave 0, rodada ANTES do fan-out. Reusa o motor de globs do zoning.

import { matchesAny } from './zoning.ts';

export type Severity = 'critical' | 'warning';

export interface Finding {
  rule: 'R1' | 'R3' | 'R4' | 'R5' | 'R6';
  severity: Severity;
  slot?: string;
  message: string;
}

export interface SlotContract {
  id: string;
  milestone: string;
  designSpec: string; // texto cru da DESIGN-SPEC.md ('' se ausente)
  territory: string[];
  dependsOn: string[];
}

export interface VerifyInput {
  slots: SlotContract[];
  sharedContract: string;
  neutralZones: string[];
  /** Conjunto completo de slots (todos os milestones) usado APENAS pra resolver deps cross-milestone no R5. Defaults pra `slots` quando omitido. */
  allSlots?: SlotContract[];
}

export interface ContractVerification {
  ok: boolean;
  findings: Finding[];
}

// R1 — Zod completo, nunca z.any().
export function checkNoZAny(slots: SlotContract[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of slots) {
    if (/z\s*\.\s*any\s*\(/.test(s.designSpec)) {
      findings.push({
        rule: 'R1',
        severity: 'critical',
        slot: s.id,
        message: `DESIGN-SPEC usa z.any() - o tipo deve ser completo (slot ${s.id}).`,
      });
    }
  }
  return findings;
}

// R6 — slot de TELA (front) com acao de CRUD precisa declarar a secao "Fluxo de interacao".
// Ataca a "casca": botao de criar/editar/excluir sem o fluxo (gatilho->modal->mutation->
// refetch) especificado + sem smoke de UI. Telas read-only (sem gatilho de mutacao) passam.
const FRONT_SCREEN_GLOB = /apps\/web\/app\//;
const MUTATION_TRIGGER = /\b(novo|nova|adicionar|criar|cadastr\w*|editar|excluir|deletar|remover|arquivar)\b/i;
const FLOW_SECTION = /fluxo de intera/i;

export function checkFrontFlow(slots: SlotContract[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of slots) {
    const isScreen = s.territory.some((t) => FRONT_SCREEN_GLOB.test(t));
    if (!isScreen) continue;
    if (!MUTATION_TRIGGER.test(s.designSpec)) continue; // tela read-only -> ok
    if (!FLOW_SECTION.test(s.designSpec)) {
      findings.push({
        rule: 'R6',
        severity: 'critical',
        slot: s.id,
        message:
          `DESIGN-SPEC de tela com acao (criar/editar/excluir) sem secao "Fluxo de interacao" ` +
          `- declare gatilho->modal->mutation->feedback->refetch + smoke de UI test-first (slot ${s.id}).`,
      });
    }
  }
  return findings;
}

/** Caminho concreto representativo de um glob, pra detectar sobreposicao. */
export function sampleFromGlob(glob: string): string {
  return glob.replace(/\*\*/g, 'a/b').replace(/\*/g, 'seg');
}

/** Dois globs conflitam se um caminho representativo de um casa com o outro. Heuristica
 *  (nao e um solver completo de intersecao de globs): pega identicos e relacoes de subset. */
export function globsConflict(g1: string, g2: string): boolean {
  if (g1 === g2) return true;
  return matchesAny(sampleFromGlob(g1), [g2]) || matchesAny(sampleFromGlob(g2), [g1]);
}

// R3 — territorios disjuntos entre slots + nenhum territorio invadindo zona neutra.
export function checkTerritoriesDisjoint(slots: SlotContract[], neutralZones: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of slots) {
    for (const g of s.territory) {
      if (matchesAny(sampleFromGlob(g), neutralZones)) {
        findings.push({
          rule: 'R3', severity: 'critical', slot: s.id,
          message: `territorio "${g}" invade zona neutra (slot ${s.id}) - zona neutra e do Integrador.`,
        });
      }
    }
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!, b = slots[j]!;
      for (const ga of a.territory) {
        for (const gb of b.territory) {
          if (globsConflict(ga, gb)) {
            findings.push({
              rule: 'R3', severity: 'critical',
              message: `territorios sobrepostos: ${a.id} "${ga}" x ${b.id} "${gb}" - dois slots no mesmo arquivo = conflito no merge.`,
            });
          }
        }
      }
    }
  }
  return findings;
}

// R5 — toda dependencia do DEPENDS-ON resolve a um slot existente (wave valida).
// `universe` e o conjunto completo de slots (todos os milestones) usado pra resolver
// deps cross-milestone; `slots` sao os que estao sendo verificados.
export function checkDependencies(slots: SlotContract[], universe: SlotContract[]): Finding[] {
  const findings: Finding[] = [];
  const exists = (milestone: string, id: string) =>
    universe.some((s) => s.milestone === milestone && s.id === id);
  for (const s of slots) {
    for (const dep of s.dependsOn) {
      const qualified = dep.includes('/');
      const m = qualified ? dep.slice(0, dep.indexOf('/')) : s.milestone;
      const id = qualified ? dep.slice(dep.indexOf('/') + 1) : dep;
      if (!exists(m, id)) {
        findings.push({
          rule: 'R5', severity: 'critical', slot: s.id,
          message: `DEPENDS-ON aponta pra "${dep}", que nao existe - wave quebrada (slot ${s.id}).`,
        });
      }
    }
  }
  return findings;
}

export function verifyContract(input: VerifyInput): ContractVerification {
  if (input.slots.length === 0) return { ok: true, findings: [] };
  const findings = [
    ...checkNoZAny(input.slots),
    ...checkTerritoriesDisjoint(input.slots, input.neutralZones),
    ...checkDependencies(input.slots, input.allSlots ?? input.slots),
    ...checkManifesto(input.sharedContract, input.slots),
    ...checkFrontFlow(input.slots),
  ];
  const ok = !findings.some((f) => f.severity === 'critical');
  return { ok, findings };
}

// R4 — manifesto de componentizacao presente e populado (warning nesta fase).
export function checkManifesto(sharedContract: string, _slots: SlotContract[]): Finding[] {
  const re = /##\s*manifesto de componentiza/i;
  if (!re.test(sharedContract)) {
    return [{
      rule: 'R4', severity: 'warning',
      message: 'SHARED-CONTRACT sem secao "Manifesto de Componentizacao" - decida o que e compartilhado ANTES do fan-out.',
    }];
  }
  const start = sharedContract.search(re);
  const after = sharedContract.slice(start);
  const nl = after.indexOf('\n');
  const body = nl === -1 ? '' : after.slice(nl + 1);
  const nextHeading = body.search(/^##\s/m);
  const section = nextHeading === -1 ? body : body.slice(0, nextHeading);
  const rows = section.split('\n').filter((l) => /^\s*\|/.test(l));
  const dataRows = rows.filter((l) =>
    !/---/.test(l) && !/componente\s*\|/i.test(l) && !/exemplo/i.test(l),
  );
  if (dataRows.length === 0) {
    return [{
      rule: 'R4', severity: 'warning',
      message: 'Manifesto de Componentizacao vazio (so placeholder) - liste os componentes/hooks compartilhados.',
    }];
  }
  return [];
}
