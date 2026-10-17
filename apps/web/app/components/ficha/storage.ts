import { z } from 'zod';
import { CompatibleExtractionResultSchema, FichaSchema, LegacyFichaSchema, normalizeFicha } from '@app/shared';
import { imageHash } from './codex';
import { WorkflowSchema, matchesFinalFicha } from '@/lib/workflow/flow';

const LegacyExtractionSchema = z.object({ ficha: LegacyFichaSchema, warnings: z.array(z.string().max(2000)).max(50) }).strict();
export const ProvenanceSchema = z.object({ source: z.enum(['codex', 'gemini']), imageSha256: z.string().regex(/^[a-f0-9]{64}$/i), initialExtraction: CompatibleExtractionResultSchema, reviewed: z.boolean(), legacyInitialExtraction: LegacyExtractionSchema.optional() }).strict();

const CurrentRecordSchema = z.object({ id: z.string().min(1).max(100), updatedAt: z.string().datetime(), fileName: z.string().max(255), image: z.string().max(15_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).or(z.literal('')), ficha: FichaSchema, warnings: z.array(z.string().max(2000)).max(50), example: z.boolean(), provenance: ProvenanceSchema.optional(), legacyFicha: LegacyFichaSchema.optional(), workflow: WorkflowSchema.optional() }).strict().superRefine((record, ctx) => {
  if (record.workflow && !matchesFinalFicha(record.workflow, record.ficha)) ctx.addIssue({ code: 'custom', message: 'Ficha final diverge do enriquecimento aprovado.' });
});
export function migrateRecord(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>;
  const old = LegacyFichaSchema.safeParse(raw.ficha);
  const provenance = raw.provenance && typeof raw.provenance === 'object' ? raw.provenance as Record<string, unknown> : undefined;
  const oldExtraction = LegacyExtractionSchema.safeParse(provenance?.initialExtraction);
  if (!old.success && !oldExtraction.success) return input;
  return { ...raw, ...(old.success ? { ficha: normalizeFicha(old.data), legacyFicha: raw.legacyFicha ?? old.data } : {}), ...(provenance ? { provenance: { ...provenance, ...(oldExtraction.success ? { initialExtraction: CompatibleExtractionResultSchema.parse(oldExtraction.data), legacyInitialExtraction: provenance.legacyInitialExtraction ?? oldExtraction.data } : {}), reviewed: false } } : {}) };
}
export const RecordSchema = z.preprocess(migrateRecord, CurrentRecordSchema);
export type FichaRecord = z.infer<typeof RecordSchema>;
export const BackupSchema = z.object({ version: z.literal(1), fichas: z.array(RecordSchema).max(100) }).strict();
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ficha-studio', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('fichas', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Armazenamento local indisponível. Faça um backup antes de sair.'));
  });
}
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('fichas', mode);
    const req = action(transaction.objectStore('fichas'));
    transaction.oncomplete = () => { db.close(); resolve(req.result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(new Error('Não foi possível salvar no navegador. Verifique o espaço disponível e exporte um backup.')); };
  });
}
export async function listRecords() { return (await operation('readonly', s => s.getAll())).map(r => RecordSchema.parse(r)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export async function saveRecord(record: FichaRecord) { await operation('readwrite', s => s.put(RecordSchema.parse(record))); }
export async function deleteRecord(id: string) { await operation('readwrite', s => s.delete(id)); }
export async function importRecords(records: FichaRecord[]) {
  for (const record of records) {
    if (record.image) await validateImage(record.image);
    if (record.provenance && (!record.image || await imageHash(record.image) !== record.provenance.imageSha256.toLowerCase())) throw new Error('A origem do Codex não corresponde à imagem do backup.');
  }
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('fichas', 'readwrite');
    const store = tx.objectStore('fichas');
    records.forEach(record => store.put(RecordSchema.parse(record)));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Falha na importação. O backup não foi aplicado.')); };
  });
}
export function validateImage(source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error('A imagem demorou demais para abrir. Tente outro arquivo.')), 15_000);
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? undefined : new Error('Imagem inválida ou corrompida. Envie outro arquivo.'));
    image.onerror = () => finish(new Error('Imagem inválida ou corrompida. Envie outro arquivo.'));
    image.src = source;
  });
}
export function readImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return Promise.reject(new Error('Envie uma imagem PNG, JPEG ou WebP.'));
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('A imagem deve ter no máximo 10 MB.'));
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const source = String(reader.result); void validateImage(source).then(() => resolve(source)).catch(reject); }; reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
}
