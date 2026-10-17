import { FIELD_GROUPS, type Ficha, type FieldKey, type FichaColor } from '@app/shared';

// Keep the extraction/storage contract structured for Python and existing backups.
const grouped: Partial<Record<FieldKey, readonly FieldKey[]>> = {
  client: ['client', 'collection', 'season'],
  seams: ['seams', 'hems'],
};
const hidden = new Set<FieldKey>(['collection', 'season', 'designer', 'hems']);
export const PRESENTATION_GROUPS = FIELD_GROUPS.map(group => ({
  ...group,
  fields: group.fields.filter(([key]) => !hidden.has(key)).map(([key, label]) => [key,
    key === 'client' ? 'Cliente / marca / coleção / estação / ano' : key === 'seams' ? 'Costuras e bainhas' : label,
  ] as const),
}));
export function hasInformation(value: string): boolean {
  return Boolean(value.trim()) && !/^nao informado[.!]?$/i.test(value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}
export function fieldValue(ficha: Ficha, key: FieldKey, preview = false): string {
  if (preview) return [...new Set((grouped[key] ?? [key]).map(k => ficha[k].trim()).filter(hasInformation))].join(key === 'client' ? ' — ' : '\n');
  if (!(grouped[key] ?? []).some(k => k !== key && ficha[k].trim())) return ficha[key];
  const values = (grouped[key] ?? [key]).map(k => ficha[k].trim()).filter(Boolean);
  return [...new Set(values)].join(key === 'client' ? ' — ' : '\n');
}
export function fieldUpdates(key: FieldKey, value: string): Partial<Record<FieldKey, string>> {
  return Object.fromEntries((grouped[key] ?? [key]).map(k => [k, k === key ? value : '']));
}
export function colorTitle(color: FichaColor): string {
  return `Cor ${color.number}${color.name ? ` - ${color.name}` : ''}`;
}
export function parseColorTitle(text: string, previous: FichaColor): FichaColor {
  const raw = text.replace(/^\s+/, '');
  const match = raw.match(/^cor\s+(\S{1,20})(?:\s+(?:[-—:]\s*)?(.*))?$/i)
    ?? raw.match(/^(\d{1,20})\s*(?:[-—:]\s*)?(.*)$/);
  return { ...previous, number: match?.[1] ?? previous.number, name: match ? match[2] ?? '' : text };
}
