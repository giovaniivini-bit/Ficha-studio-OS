import { z } from 'zod';
import { CompatibleExtractionResultSchema, LegacyFichaSchema, type ExtractionResult, type Ficha } from '@app/shared';
import type { FichaRecord } from './storage';
export const CodexImportSchema = z.object({ version: z.union([z.literal(1), z.literal(2)]), sourceFileName: z.string().min(1).max(255), imageSha256: z.string().regex(/^[a-f0-9]{64}$/i), extraction: CompatibleExtractionResultSchema, legacyFicha: LegacyFichaSchema.optional() }).strict();
export function hasFichaContent(ficha: Ficha) { return Object.entries(ficha).some(([key, value]) => key === 'colors' ? (value as Ficha['colors']).length > 0 : Boolean(value)); }
export function editRecordFicha(record: FichaRecord, ficha: Ficha): FichaRecord { return { ...record, ficha, provenance: record.provenance ? { ...record.provenance, reviewed: false } : undefined }; }
export async function imageHash(image: string) {
  const base64 = image.split(',')[1];
  if (!base64) throw new Error('Carregue a imagem original antes de importar a extração.');
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function parseCodexImport(json: unknown, image: string) {
  if (!image) throw new Error('Carregue a imagem original antes de importar a extração.');
  const result = CodexImportSchema.safeParse(json);
  if (!result.success) throw new Error('JSON do Codex inválido. Confira a versão e os campos do formato esperado.');
  if (await imageHash(image) !== result.data.imageSha256.toLowerCase()) throw new Error('A extração pertence a outra imagem. Envie exatamente o arquivo original usado no Codex.');
  const rawExtraction = (json as { extraction: unknown }).extraction;
  const legacy = z.object({ ficha: LegacyFichaSchema, warnings: z.array(z.string().max(2000)).max(50) }).strict().safeParse(rawExtraction);
  return { ...result.data, imageSha256: result.data.imageSha256.toLowerCase(), ...(legacy.success ? { legacyInitialExtraction: legacy.data } : {}) };
}
export async function bindExtraction(record: FichaRecord, result: ExtractionResult, provider: 'gemini' | 'codex' | 'anthropic'): Promise<FichaRecord> {
  return { ...record, ficha: result.ficha, warnings: result.warnings, example: false, provenance: provider === 'codex' || provider === 'gemini' ? { source: provider, imageSha256: await imageHash(record.image), initialExtraction: result, reviewed: false } : undefined };
}
export function reviewedDataset(records: FichaRecord[]) {
  return { version: 2, schemaVersion: 2, purpose: 'Exemplos revisados para desenvolvimento do extrator. Nenhum treinamento automático.', examples: records.filter(r => r.provenance?.reviewed && r.image && !r.example).map(r => ({ reviewed: true, id: r.id, sourceFileName: r.fileName, imageSha256: r.provenance!.imageSha256, image: r.image, initialExtraction: r.provenance!.initialExtraction, ficha: r.ficha, warnings: r.warnings, reviewedAt: r.updatedAt, ...(r.legacyFicha ? { legacyFicha: r.legacyFicha } : {}), ...(r.provenance?.legacyInitialExtraction ? { legacyInitialExtraction: r.provenance.legacyInitialExtraction } : {}) })) };
}
export function downloadJson(value: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
