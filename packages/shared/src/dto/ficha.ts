import { z } from 'zod';

export const FIELD_GROUPS = [
  { title: 'Identificação', fields: [ ['reference', 'Referência'], ['secondaryCode', 'Código secundário'], ['modeling', 'MODELAGEM'], ['client', 'Cliente / marca'], ['collection', 'Coleção'], ['season', 'Estação / ano'], ['labelCode', 'ETIQUETA'], ['sizes', 'Grade de tamanhos'], ['designer', 'Estilista'] ] },
  { title: 'Materiais e cores', fields: [ ['mainMaterial', 'Material principal'], ['composition', 'Composição'], ['weight', 'Gramatura'], ['complementaryMaterials', 'Materiais complementares'] ] },
  { title: 'Construção e acabamentos', fields: [ ['construction', 'Construção / recortes'], ['seams', 'Costuras'], ['neckline', 'Gola / cós'], ['hems', 'Bainhas'], ['measurements', 'Medidas indicadas'] ] },
  { title: 'Aplicações e aviamentos', fields: [ ['print', 'Estampa'], ['embroidery', 'Bordado'], ['applique', 'Aplique'], ['artworkReference', 'Referência de arte'], ['trim1', 'Aviamento 1'], ['trim2', 'Aviamento 2'], ['trim3', 'Aviamento 3'], ['trim4', 'Aviamento 4'], ['labels', 'Outras informações de etiquetas'] ] },
  { title: 'Observações e revisão', fields: [ ['changes', 'Alterações solicitadas'], ['notes', 'Observações técnicas'] ] },
] as const;

const value = z.string().max(8000);
export const ColorSchema = z.object({ number: z.string().min(1).max(20), name: value, pantone: value, code: value }).strict();
export type FichaColor = z.infer<typeof ColorSchema>;
export const FichaSchema = z.object({
  reference: value, secondaryCode: value, modeling: value, client: value,
  collection: value, season: value, labelCode: value, sizes: value, designer: value,
  mainMaterial: value, composition: value, weight: value, complementaryMaterials: value,
  colors: z.array(ColorSchema).max(50), construction: value, seams: value, neckline: value, hems: value,
  measurements: value, print: value, embroidery: value, applique: value, artworkReference: value,
  trim1: value, trim2: value, trim3: value, trim4: value,
  labels: value, changes: value, notes: value,
}).strict();
export type Ficha = z.infer<typeof FichaSchema>;
export type FieldKey = Exclude<keyof Ficha, 'colors'>;
export function emptyFicha(): Ficha {
  return FichaSchema.parse({ ...Object.fromEntries(FIELD_GROUPS.flatMap(g => g.fields.map(([k]) => [k, '']))), colors: [] });
}

// Contrato antigo aceito somente nas fronteiras de armazenamento/importação.
export const LegacyFichaSchema = z.object({
  reference: value, secondaryCode: value, product: value, client: value,
  collection: value, season: value, line: value, sizes: value, designer: value,
  mainMaterial: value, composition: value, weight: value, complementaryMaterials: value,
  colors: value, construction: value, seams: value, neckline: value, hems: value,
  measurements: value, artwork: value, artworkReference: value, trims: value,
  labels: value, changes: value, notes: value,
}).strict();
export type LegacyFicha = z.infer<typeof LegacyFichaSchema>;

export function splitSeasonLabel(season: string, collection = '') {
  const matches = [...season.matchAll(/\(([^()]*)\)/g)];
  const fallback = [...collection.matchAll(/\(([A-Z0-9-]{2,15})\)/g)];
  const codes = matches.length ? matches.map(m => m[1]!.trim()) : fallback.map(m => m[1]!);
  return { season: season.replace(/\s*\([^()]*\)/g, '').trim(), labelCode: codes.join(' / '), collection: collection.replace(/\s*\(([A-Z0-9-]{2,15})\)/g, '').trim() };
}

export function parseLegacyColors(text: string): FichaColor[] {
  if (!text.trim()) return [];
  const chunks = text.split(/\s*(?:;|\n)\s*|(?=Cor\s*\d+\s*[-—:])/i).filter(s => s.trim());
  return chunks.map((chunk, index) => {
    const number = chunk.match(/^Cor\s*(\d+)\s*[-—:]?\s*/i);
    let name = chunk.replace(/^Cor\s*\d+\s*[-—:]?\s*/i, '').trim();
    const codes = [...name.matchAll(/\(([^()]*)\)/g)].map(m => m[1]!.trim());
    name = name.replace(/\s*\([^()]*\)/g, '').trim();
    const pantone = name.match(/\b\d{2}-\d{4}(?:\s+(?:TCX|TPX|TPG|C|U))?\b/);
    if (pantone) name = name.replace(pantone[0], '').replace(/\s{2,}/g, ' ').replace(/[\s.,]+$/, '').trim();
    return { number: number?.[1] ?? String(index + 1).padStart(2, '0'), name, pantone: pantone?.[0] ?? '', code: codes.join(' / ') };
  });
}

export function migrateLegacyFicha(old: LegacyFicha): Ficha {
  const next = emptyFicha();
  for (const group of FIELD_GROUPS) for (const [key] of group.fields) {
    if (key in old) next[key] = old[key as keyof LegacyFicha];
  }
  next.modeling = old.product;
  Object.assign(next, splitSeasonLabel(old.season, old.collection));
  next.colors = parseLegacyColors(old.colors);
  const migrationNotes: string[] = [];
  const artParts = old.artwork.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ])/u).filter(Boolean);
  for (const part of artParts) {
    const key = /^bordad/i.test(part) ? 'embroidery' : /^aplique/i.test(part) ? 'applique' : /^estampa/i.test(part) ? 'print' : undefined;
    if (key) next[key] = [next[key], part].filter(Boolean).join(' ');
    else migrationNotes.push(`Aplicação antiga sem classificação confirmada: ${part}`);
    if (key === 'applique' && /estampad|rebordad|bordad/i.test(part)) migrationNotes.push(`Conferir separação das operações do aplique: ${part}`);
  }
  const labelParts = old.labels.split(/\n|;\s*(?=tag\b|selo\b)|(?<=[.!?])\s+(?=(?:tag|selo)\b)/i).map(s => s.trim()).filter(Boolean);
  const isTrim = (text: string) => /tag\b|selo\b|interativ/i.test(text);
  next.labels = labelParts.filter(s => !isTrim(s)).join('\n');
  const trims = [...old.trims.split(/\n|;\s*|\.\s+(?=(?:cadarço|ilhós|tag|selo|botão|zíper)\b)/i), ...labelParts.filter(isTrim)].map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(trims.length, 4); i++) next[`trim${i + 1}` as 'trim1' | 'trim2' | 'trim3' | 'trim4'] = trims[i]!;
  if (trims.length > 4) migrationNotes.push(`Aviamentos adicionais da ficha antiga: ${trims.slice(4).join('; ')}`);
  if (migrationNotes.length) next.notes = [old.notes, ...migrationNotes].filter(Boolean).join('\n');
  // Não inferir informação ilegível nem reaprovar automaticamente a conversão.
  return FichaSchema.parse(next);
}
export const CompatibleFichaSchema = z.union([FichaSchema, LegacyFichaSchema.transform(migrateLegacyFicha)]);
export function normalizeFicha(input: unknown): Ficha { return CompatibleFichaSchema.parse(input); }

export function standardizeFicha(input: Ficha): Ficha {
  const parts = splitSeasonLabel(input.season, input.collection);
  const labelCode = [...new Set([input.labelCode, parts.labelCode].flatMap(s => s.split(' / ')).map(s => s.replace(/^\((.*)\)$/, '$1').trim()).filter(Boolean))].join(' / ');
  return FichaSchema.parse({ ...input, ...parts, labelCode, colors: input.colors.map(color => ({ ...color, code: color.code.replace(/^\((.*)\)$/, '$1').trim() })) });
}

export const EXTRACTION_RULES = `Regras da empresa: modeling é MODELAGEM: transcreva o código do rodapé, por exemplo "Top MC D.200"; MC significa manga curta e D.200 modelagem Disney 200. Preserve o código literal, sem substituí-lo por "camiseta". Separe a sigla entre parênteses do cabeçalho/estação em labelCode (ETIQUETA), por exemplo WINTER I 2027 (CFC) vira season="WINTER I 2027", labelCode="CFC"; não incluir essa sigla em season nem collection. Não existe campo Linha. colors é uma lista de objetos {number,name,pantone,code}: uma entrada por Cor 01, Cor 02 e assim por diante; name contém o nome da cor; pantone contém somente referência Pantone; code contém o identificador entre parênteses, por exemplo MC 7062615. Não converter números nem adivinhar códigos. Separar print (Estampa), embroidery (Bordado) e applique (Aplique), sem misturar instruções. Preencher trim1,trim2,trim3,trim4 com um aviamento por campo, incluindo TAG BCI e selo de detalhe interativo quando visíveis, com código/fornecedor legíveis. labelCode é a sigla do cabeçalho e NÃO a tag BCI. Se houver mais de quatro aviamentos, preservar os excedentes em notes e avisar. Não inventar quantidades ou aviamentos ausentes.`;

const stringProperties = Object.fromEntries(FIELD_GROUPS.flatMap(g => g.fields.map(([key]) => [key, { type: 'string' }])));
export const FICHA_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: [...Object.keys(stringProperties), 'colors'],
  properties: { ...stringProperties, colors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['number', 'name', 'pantone', 'code'], properties: { number: { type: 'string' }, name: { type: 'string' }, pantone: { type: 'string' }, code: { type: 'string' } } } } },
};
export const ExtractionRequestSchema = z.object({
  image: z.string().max(15_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
  fileName: z.string().min(1).max(255),
}).strict();
export const ExtractionResultSchema = z.object({
  ficha: FichaSchema,
  warnings: z.array(z.string().max(2000)).max(50),
}).strict();
export const CompatibleExtractionResultSchema = z.object({ ficha: CompatibleFichaSchema, warnings: z.array(z.string().max(2000)).max(50) }).strict();
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
