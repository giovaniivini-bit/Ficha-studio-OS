import { it, expect } from 'vitest';
import { emptyFicha } from '@app/shared';
import { approveReading, completeEnrichment, WorkflowSchema, matchSecondaryRules } from './flow';
const rule = { name: 'Ribana 2x1', code: '1123343', composition: '97% co 3% oue', weight: '255', width: '1m', notes: 'Teste', source: { file: 'malhas.xlsx', sheet: 'Malhas', row: 3 } };
it('identifica ribana dentro da instrução sem confundir 1x1 com 2x1', () => {
  expect(matchSecondaryRules('Ribana 2x1 na cor 02', [rule])).toEqual([rule]);
  expect(matchSecondaryRules('Ribana 1x1 na cor 02', [rule])).toEqual([]);
});
it('salva os dados secundários separados do principal e preserva a instrução', () => {
  const ficha = { ...emptyFicha(), complementaryMaterials: 'Ribana 2x1 na cor 02', composition: '100% co', weight: '155' };
  const result = completeEnrichment(approveReading(ficha, 'manual'), ficha, { secondaryRule: rule, decisions: {}, skipped: false });
  expect(WorkflowSchema.parse(result).enrichment?.secondaryMaterial).toEqual({ description: ficha.complementaryMaterials, rule });
  expect(result.enrichment?.after.composition).toBe('100% co');
});
