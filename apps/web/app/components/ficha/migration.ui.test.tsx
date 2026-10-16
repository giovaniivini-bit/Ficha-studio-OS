import { describe, expect, it } from 'vitest';
import { FIELD_GROUPS, emptyFicha, LegacyFichaSchema } from '@app/shared';
import { BackupSchema, migrateRecord, RecordSchema } from './storage';
import { editRecordFicha, hasFichaContent, parseCodexImport, reviewedDataset } from './codex';
import { vi } from 'vitest';
const old = LegacyFichaSchema.parse({ reference: '123', secondaryCode: '', product: 'Top MC D.200', client: '', collection: 'Baby Club (CFC)', season: 'WINTER I 2027 (CFC)', line: 'baby', sizes: '', designer: '', mainMaterial: '', composition: '', weight: '', complementaryMaterials: '', colors: 'Cor 02 — Skyway 14-4112 (MC 4060288)\nCor 07 — White 11-0601 (MC 791510)', construction: '', seams: '', neckline: '', hems: '', measurements: '', artwork: 'Estampa frente. Bordado costas. Aplique manga.', artworkReference: '', trims: 'Ilhós', labels: 'Tag BCI código 123', changes: '', notes: 'edição não salva' });
const hash = 'ab'.repeat(32);
const base = { id: 'draft', updatedAt: new Date().toISOString(), image: 'data:image/png;base64,cG5n', fileName: 'x.png', ficha: old, example: false, warnings: [], provenance: { source: 'codex', imageSha256: hash, initialExtraction: { ficha: old, warnings: [] }, reviewed: true } };
describe('Migração v2 sem perda do original', () => {
  it('preserva rascunho e origem antigos, separa CFC e revoga aprovação', () => {
    const migrated = RecordSchema.parse(migrateRecord(base));
    expect(migrated.legacyFicha).toEqual(old);
    expect(migrated.ficha).toMatchObject({ modeling: 'Top MC D.200', season: 'WINTER I 2027', labelCode: 'CFC', notes: 'edição não salva' });
    expect(migrated.ficha.colors).toHaveLength(2);
    expect(migrated.ficha.colors[1]).toMatchObject({ number: '07', pantone: '11-0601', code: 'MC 791510' });
    expect(migrated.provenance?.legacyInitialExtraction?.ficha).toEqual(old);
    expect(migrated.provenance?.reviewed).toBe(false);
    expect(RecordSchema.parse(migrated)).toEqual(migrated);
    expect(reviewedDataset([migrated]).examples).toHaveLength(0);
  });
  it('aceita backup antigo e rejeita chave desconhecida', () => {
    expect(BackupSchema.parse({ version: 1, fichas: [base] }).fichas[0]?.legacyFicha).toEqual(old);
    expect(RecordSchema.safeParse({ ...base, rogue: true }).success).toBe(false);
    expect(RecordSchema.safeParse({ ...base, ficha: { ...old, rogue: 'value' } }).success).toBe(false);
  });
  it('não considera cores vazias como ficha preenchida e mantém os grupos escalares', () => {
    expect(hasFichaContent(emptyFicha())).toBe(false);
    expect(FIELD_GROUPS.flatMap(group => group.fields.map(([key]) => key))).not.toContain('colors');
  });
  it('edição de cores exige nova aprovação, preservando a extração inicial', () => {
    const migrated = RecordSchema.parse(base);
    const approved = { ...migrated, provenance: { ...migrated.provenance!, reviewed: true } };
    const edited = editRecordFicha(approved, { ...approved.ficha, colors: [{ number: '07', name: 'Azul editado', pantone: '14-4112', code: 'literal' }] });
    expect(edited.provenance?.reviewed).toBe(false);
    expect(edited.provenance?.initialExtraction).toEqual(approved.provenance.initialExtraction);
    expect(reviewedDataset([edited]).examples).toHaveLength(0);
    expect(reviewedDataset([approved])).toMatchObject({ version: 2, schemaVersion: 2 });
  });
  it('importa JSON antigo mantendo extração original para auditoria', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
    try { const imported = await parseCodexImport({ version: 1, sourceFileName: 'x.png', imageSha256: hash, extraction: { ficha: old, warnings: [] } }, base.image); expect(imported.extraction.ficha.modeling).toBe('Top MC D.200'); expect(imported.legacyInitialExtraction?.ficha).toEqual(old); } finally { digest.mockRestore(); }
  });
});
