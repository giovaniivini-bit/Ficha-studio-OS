import { z } from 'zod';
import { FichaSchema, FIELD_GROUPS, type Ficha, type FieldKey } from '@app/shared';
import { FabricRuleSchema, matchRules, type FabricRule, type FabricCatalog } from '../rules/catalog';

const decisionsSchema = z.record(z.enum(['keep', 'rule']));
const equal = (a: Ficha, b: Ficha) => Object.keys(FichaSchema.shape).every(key => JSON.stringify(a[key as keyof Ficha]) === JSON.stringify(b[key as keyof Ficha]));
export const WorkflowSchema = z.object({
  mode: z.enum(['image', 'manual']),
  readApproved: z.object({ at: z.string().datetime(), ficha: FichaSchema }).strict().optional(),
  ruleDraft: z.object({ catalogId: z.string(), query: z.string().max(4000), selectedCode: z.string().max(4000), secondaryCode: z.string().max(4000).optional(), decisions: decisionsSchema }).strict().optional(),
  enrichment: z.object({ at: z.string().datetime(), catalogId: z.string().uuid().optional(), catalogApprovedAt: z.string().datetime().optional(), rule: FabricRuleSchema.optional(), secondaryMaterial: z.object({ description: z.string().max(4000), rule: FabricRuleSchema }).strict().optional(), before: FichaSchema, after: FichaSchema, decisions: decisionsSchema, skipped: z.boolean() }).strict().optional(),
  finalApprovedAt: z.string().datetime().optional(), savedAt: z.string().datetime().optional(), previousFinal: FichaSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.enrichment && (!value.readApproved || !equal(value.enrichment.before, value.readApproved.ficha))) ctx.addIssue({ code: 'custom', message: 'Enriquecimento exige a mesma leitura aprovada.' });
  if (value.ruleDraft && !value.readApproved) ctx.addIssue({ code: 'custom', message: 'Rascunho de regras exige leitura aprovada.' });
  if (value.finalApprovedAt && !value.enrichment) ctx.addIssue({ code: 'custom', message: 'Aprove o enriquecimento antes da aprovação final.' });
  if (value.savedAt && !value.finalApprovedAt) ctx.addIssue({ code: 'custom', message: 'Salvar ficha final exige aprovação final.' });
});
export type Workflow = z.infer<typeof WorkflowSchema>;
const snapshot = (ficha: Ficha) => FichaSchema.parse(ficha);
export function approveReading(ficha: Ficha, mode: Workflow['mode'], previous?: Workflow): Workflow {
  return WorkflowSchema.parse({ mode, readApproved: { at: new Date().toISOString(), ficha: snapshot(ficha) }, previousFinal: previous?.enrichment?.after ?? previous?.previousFinal });
}
export function invalidateWorkflow(workflow?: Workflow, currentFicha?: Ficha): Workflow | undefined {
  if (!workflow) return undefined;
  return WorkflowSchema.parse({ mode: workflow.mode, previousFinal: workflow.enrichment?.after ?? workflow.previousFinal ?? currentFicha });
}
export type MaterialChange = { key: FieldKey; label: string; before: string; suggested: string; conflict: boolean };
const absent = (value: string) => !value.trim() || /^n[aã]o informado\.?$/i.test(value.trim());
const labels: Partial<Record<FieldKey, string>> = {};
for (const group of FIELD_GROUPS) for (const [key, label] of group.fields) labels[key] = label;
export function buildMaterialChanges(ficha: Ficha, rule: FabricRule): MaterialChange[] {
  const checked = FabricRuleSchema.parse(rule);
  const addedNotes = [checked.width && `Largura: ${checked.width}`, checked.notes && `Observações da malha: ${checked.notes}`].filter((s): s is string => Boolean(s));
  const existingNotes = absent(ficha.notes) ? [] : ficha.notes.split('\n');
  const notes = [...existingNotes, ...addedNotes.filter(line => !existingNotes.includes(line))].join('\n');
  const suggested: Partial<Record<FieldKey, string>> = { mainMaterial: `${checked.name} (código ${checked.code})`, composition: checked.composition, weight: checked.weight, ...(addedNotes.length ? { notes } : {}) };
  return (Object.entries(suggested) as [FieldKey, string][]).filter(([key, value]) => !absent(value) && ficha[key] !== value).map(([key, value]) => ({ key, label: labels[key] ?? key, before: ficha[key], suggested: value, conflict: !absent(ficha[key]) }));
}
export function applyMaterialChanges(ficha: Ficha, rule: FabricRule, decisions: Record<string, 'keep' | 'rule'>): Ficha {
  decisionsSchema.parse(decisions);
  const result = snapshot(ficha);
  for (const change of buildMaterialChanges(ficha, rule)) {
    if (change.conflict && !decisions[change.key]) throw new Error(`Escolha manter ou aplicar a regra para ${change.label}.`);
    if (decisions[change.key] !== 'keep') result[change.key] = change.suggested;
  }
  return snapshot(result);
}
export function matchSecondaryRules(description: string, rules: FabricRule[]): FabricRule[] {
  const exact = matchRules(description, rules);
  if (exact.length) return exact;
  const ribana = description.match(/\bribana\s+(\d+)\s*x\s*(\d+)\b/i);
  return ribana ? matchRules(`ribana ${ribana[1]}x${ribana[2]}`, rules) : [];
}
export function completeEnrichment(workflow: Workflow, after: Ficha, metadata: { catalog?: FabricCatalog; rule?: FabricRule; secondaryRule?: FabricRule; decisions: Record<string, 'keep' | 'rule'>; skipped: boolean }): Workflow {
  const checked = WorkflowSchema.parse(workflow);
  if (!checked.readApproved) throw new Error('Aprove a leitura antes de consultar regras.');
  return WorkflowSchema.parse({ ...checked, ruleDraft: undefined, enrichment: { at: new Date().toISOString(), catalogId: metadata.catalog?.id, catalogApprovedAt: metadata.catalog?.approvedAt, rule: metadata.rule, secondaryMaterial: !metadata.skipped && metadata.secondaryRule && after.complementaryMaterials.trim() ? { description: after.complementaryMaterials, rule: metadata.secondaryRule } : undefined, before: snapshot(checked.readApproved.ficha), after: snapshot(after), decisions: metadata.decisions, skipped: metadata.skipped }, finalApprovedAt: undefined, savedAt: undefined });
}
export function approveFinal(workflow: Workflow): Workflow {
  const checked = WorkflowSchema.parse(workflow);
  if (!checked.enrichment) throw new Error('Conclua a etapa de regras antes de aprovar a ficha final.');
  return WorkflowSchema.parse({ ...checked, finalApprovedAt: new Date().toISOString(), savedAt: undefined });
}
export function finishSaved(workflow: Workflow): Workflow {
  const checked = WorkflowSchema.parse(workflow);
  if (!checked.finalApprovedAt) throw new Error('Aprove a ficha final antes de salvar.');
  return WorkflowSchema.parse({ ...checked, savedAt: new Date().toISOString() });
}
export function matchesFinalFicha(workflow: Workflow, ficha: Ficha) { return !workflow.finalApprovedAt || Boolean(workflow.enrichment && equal(workflow.enrichment.after, ficha)); }
