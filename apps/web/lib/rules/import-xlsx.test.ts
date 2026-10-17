import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { checkWorkbookZip, verifyZipPayload, readRuleWorkbook } from './import-xlsx';

describe('Limites de importação XLSX', () => {
  it('limita bytes reais mesmo com tamanho declarado adulterado', () => {
    const zip = zipSync({ 'test.xml': new Uint8Array(10000) });
    const view = new DataView(zip.buffer);
    for (let i = 0; i + 46 <= zip.length; i++) if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 1, true);
    expect(() => checkWorkbookZip(zip.buffer)).not.toThrow();
    expect(() => verifyZipPayload(zip, 100)).toThrow(/Limite real/);
  });
  it('aceita ZIP pequeno e rejeita arquivos inválidos antes da biblioteca Excel', async () => {
    expect(() => verifyZipPayload(zipSync({ 'ok.xml': strToU8('<ok/>') }))).not.toThrow();
    expect(() => checkWorkbookZip(new ArrayBuffer(10))).toThrow(/inválido/);
    await expect(readRuleWorkbook(new File(['x'], 'fake.csv'))).rejects.toThrow(/XLSX/);
    await expect(readRuleWorkbook(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.xlsx'))).rejects.toThrow(/2 MB/);
  });
});
