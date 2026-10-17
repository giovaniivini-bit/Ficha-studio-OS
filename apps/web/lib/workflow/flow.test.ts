import { describe, expect, it } from 'vitest';
import { emptyFicha } from '@app/shared';
import { approveReading, buildMaterialChanges, applyMaterialChanges, completeEnrichment, approveFinal, finishSaved, invalidateWorkflow, WorkflowSchema } from './flow';
const rule = { name: 'Meia malha', code: '123', composition: '100% algodão', weight: '155', width: '1,8', notes: 'Teste', source: { file: 'a.xlsx', sheet: 'Malhas', row: 2 } };
describe('workflow de aprovação', () => {
  it('exige decisões nos conflitos e não infere unidades', () => {
    const ficha = { ...emptyFicha(), mainMaterial: 'Meia malha', composition: 'Outra', notes: 'Original' };
    expect(buildMaterialChanges(ficha, rule).find(c => c.key === 'composition')?.conflict).toBe(true);
    expect(() => applyMaterialChanges(ficha, rule, {})).toThrow();
    const after = applyMaterialChanges(ficha, rule, { mainMaterial: 'rule', composition: 'keep', notes: 'rule' });
    expect(after.composition).toBe('Outra'); expect(after.weight).toBe('155');
    expect(after.notes).toContain('Original'); expect(after.notes).toContain('Largura: 1,8');
  });
  it('exige ordem, mantém snapshots separados e invalida etapas posteriores', () => {
    const ficha = emptyFicha(); const reading = approveReading(ficha, 'image');
    expect(() => approveFinal(reading)).toThrow();
    const enriched = completeEnrichment(reading, { ...ficha, weight: '155' }, { decisions: {}, skipped: false, rule });
    const saved = finishSaved(approveFinal(enriched));
    expect(saved.savedAt).toBeTruthy(); expect(saved.readApproved?.ficha.weight).toBe('');
    expect(invalidateWorkflow(saved, enriched.enrichment!.after)).toMatchObject({ mode: 'image', previousFinal: enriched.enrichment!.after });
    expect(invalidateWorkflow(saved)?.readApproved).toBeUndefined();
    const invalidated = invalidateWorkflow(saved, enriched.enrichment!.after)!;
    expect(invalidateWorkflow(invalidated, { ...ficha, weight: 'editado' })?.previousFinal?.weight).toBe('155');
    expect(WorkflowSchema.safeParse({ mode: 'image', finalApprovedAt: new Date().toISOString() }).success).toBe(false);
  });
  it('rejeita snapshot anterior divergente e permite continuar sem regras', () => {
    const reading = approveReading(emptyFicha(), 'manual');
    const enriched = completeEnrichment(reading, emptyFicha(), { decisions: {}, skipped: true });
    expect(WorkflowSchema.safeParse({ ...enriched, enrichment: { ...enriched.enrichment!, before: { ...emptyFicha(), weight: 'x' } } }).success).toBe(false);
    expect(finishSaved(approveFinal(enriched)).savedAt).toBeTruthy();
  });
});
