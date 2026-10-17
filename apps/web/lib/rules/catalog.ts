import { z } from 'zod';

const text = z.string().max(4000);
export const FabricRuleSchema = z.object({
  name: text.min(1), sourceName: text.optional(), composition: text, code: text.min(1), weight: text, width: text, notes: text,
  source: z.object({ file: text.min(1), sheet: text.min(1), row: z.number().int().min(1) }).strict(),
}).strict();
export type FabricRule = z.infer<typeof FabricRuleSchema>;
export const CatalogSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), approvedAt: z.string().datetime(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  rules: z.array(FabricRuleSchema).min(1).max(1000),
}).strict().superRefine((catalog, ctx) => {
  const seen = new Set<string>();
  for (const rule of catalog.rules) {
    const code = normalizeRuleText(rule.code);
    if (seen.has(code)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Código repetido no catálogo.' });
    seen.add(code);
  }
});
export type FabricCatalog = z.infer<typeof CatalogSchema>;
export function normalizeRuleText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
const headers: Record<string, keyof Omit<FabricRule, 'source' | 'sourceName'>> = { malha: 'name', composicao: 'composition', codigo: 'code', gramatura: 'weight', largura: 'width', observacao: 'notes', observacoes: 'notes' };
export function parseRuleSheet(cells: string[][], file: string, sheet: string): { rules: FabricRule[]; errors: string[]; warnings: string[] } {
  const rules: FabricRule[] = [], errors: string[] = [], warnings: string[] = [];
  const start = cells.slice(0, 20).findIndex(row => row.some(v => normalizeRuleText(v) === 'malha') && row.some(v => normalizeRuleText(v) === 'codigo'));
  if (start < 0) return { rules, errors: ['Cabeçalho não encontrado: a aba deve conter MALHA e código nas primeiras 20 linhas.'], warnings };
  const columns = cells[start]!.map(v => headers[normalizeRuleText(v)]);
  const mapped = columns.filter(Boolean);
  if (new Set(mapped).size !== mapped.length) return { rules, errors: ['Há cabeçalhos repetidos. Corrija as colunas antes de importar.'], warnings };
  const codes = new Set<string>();
  for (let i = start + 1; i < cells.length; i++) {
    const row = cells[i]!;
    if (!row.some(v => v.trim())) continue;
    const item = { name: '', composition: '', code: '', weight: '', width: '', notes: '', source: { file, sheet, row: i + 1 } };
    columns.forEach((key, col) => { if (key) item[key] = row[col]?.trim() ?? ''; });
    if (!item.name || !item.code) { errors.push(`Linha ${i + 1}: malha e código são obrigatórios.`); continue; }
    if (!FabricRuleSchema.safeParse(item).success) { errors.push(`Linha ${i + 1}: conteúdo inválido ou longo demais.`); continue; }
    const code = normalizeRuleText(item.code);
    if (codes.has(code)) errors.push(`Linha ${i + 1}: código repetido (${item.code}).`);
    codes.add(code);
    rules.push(item);
  }
  if (!rules.length) errors.push('Nenhuma malha válida encontrada.');
  if (rules.length > 1000) errors.push('Limite de 1.000 malhas por catálogo.');
  const names = new Set<string>();
  for (const rule of rules) {
    const name = normalizeRuleText(rule.name);
    if (names.has(name)) warnings.push(`Nome repetido: ${rule.name}. A consulta exigirá escolha entre os códigos.`);
    names.add(name);
  }
  return { rules, errors, warnings };
}
export function matchRules(query: string, rules: FabricRule[]) {
  const key = normalizeRuleText(query);
  if (!key) return [];
  return rules.filter(rule => normalizeRuleText(rule.code) === key || normalizeRuleText(rule.name) === key);
}
