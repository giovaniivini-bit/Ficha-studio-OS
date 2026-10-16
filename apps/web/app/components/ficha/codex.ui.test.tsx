import { describe, expect, it, vi } from 'vitest';
import { emptyFicha } from '@app/shared';
import { bindExtraction, parseCodexImport, reviewedDataset } from './codex';
import { FichaConfigSchema } from '@/lib/queries/fichas';
import { RecordSchema } from './storage';
const hash = 'ab'.repeat(32);
const extraction = { ficha: emptyFicha(), warnings: [] };
describe('Importação assistida do Codex', () => {
  it('aceita configuração real Gemini/Codex e rejeita provedor desconhecido', () => {
    expect(FichaConfigSchema.parse({ configured: true, provider: 'gemini' }).provider).toBe('gemini');
    expect(FichaConfigSchema.parse({ configured: true, provider: 'codex' }).provider).toBe('codex');
    expect(FichaConfigSchema.safeParse({ configured: true, provider: 'unknown' }).success).toBe(false);
  });
  it('vincula extração real Gemini/Codex à imagem corrente como origem não revisada', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
    try {
      const record = RecordSchema.parse({ id: 'current', updatedAt: new Date().toISOString(), fileName: 'current.png', image: 'data:image/png;base64,cG5n', ficha: emptyFicha(), warnings: [], example: true });
      const result = await bindExtraction(record, extraction, 'gemini');
      expect(result).toMatchObject({ id: 'current', image: record.image, example: false, provenance: { source: 'gemini', imageSha256: hash, initialExtraction: extraction, reviewed: false } });
      expect((await bindExtraction(result, extraction, 'anthropic')).provenance).toBeUndefined();
    } finally { digest.mockRestore(); }
  });
  it('exige imagem e rejeita contrato malformado', async () => {
    await expect(parseCodexImport({}, '')).rejects.toThrow('imagem original');
    await expect(parseCodexImport({ version: 2 }, 'data:image/png;base64,cG5n')).rejects.toThrow('inválido');
  });
  it('rejeita vínculo com outra imagem', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
    try { await expect(parseCodexImport({ version: 1, sourceFileName: 'a.png', imageSha256: hash, extraction }, 'data:image/png;base64,cG5n')).rejects.toThrow('outra imagem'); } finally { digest.mockRestore(); }
  });
  it('aceita somente extração vinculada aos mesmos bytes da imagem', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
    try { const result = await parseCodexImport({ version: 1, sourceFileName: 'a.png', imageSha256: hash.toUpperCase(), extraction }, 'data:image/png;base64,cG5n'); expect(result.imageSha256).toBe(hash); expect(result.extraction).toEqual(extraction); } finally { digest.mockRestore(); }
  });
  it('exporta apenas registros aprovados e preserva extração original', () => {
    const base = { id: 'one', updatedAt: new Date().toISOString(), fileName: 'a.png', image: 'data:image/png;base64,cG5n', ficha: emptyFicha(), warnings: [], example: false };
    const reviewed = RecordSchema.parse({ ...base, provenance: { source: 'codex', imageSha256: hash, initialExtraction: extraction, reviewed: true } });
    const pending = { ...reviewed, id: 'two', provenance: { ...reviewed.provenance!, reviewed: false } };
    const data = reviewedDataset([reviewed, pending, RecordSchema.parse({ ...base, id: 'three' })]);
    expect(data.examples).toHaveLength(1);
    expect(data.examples[0]).toMatchObject({ reviewed: true, imageSha256: hash, initialExtraction: extraction, ficha: emptyFicha() });
  });
});
