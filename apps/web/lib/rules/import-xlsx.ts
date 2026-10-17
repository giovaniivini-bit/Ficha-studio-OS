import { parseRuleSheet } from './catalog';
import { Unzip, UnzipInflate } from 'fflate';

export interface RuleSheet { name: string; cells: string[][] }
// Preflight central-directory sizes before decompressing the uploaded XLSX.
export function checkWorkbookZip(buffer: ArrayBufferLike) {
  const view = new DataView(buffer);
  let total = 0, entries = 0;
  for (let i = 0; i + 46 <= view.byteLength; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const size = view.getUint32(i + 24, true);
    total += size; entries++;
    if (size === 0xffffffff || total > 20 * 1024 * 1024 || entries > 500) throw new Error('Planilha muito grande após descompactação. Limite: 20 MB e 500 itens internos.');
    i += 45 + view.getUint16(i + 28, true) + view.getUint16(i + 30, true) + view.getUint16(i + 32, true);
  }
  if (!entries) throw new Error('Arquivo XLSX inválido.');
}
export function verifyZipPayload(data: Uint8Array, maxBytes = 20 * 1024 * 1024) {
  let total = 0, entries = 0, completed = 0;
  const unzip = new Unzip(file => {
    if (++entries > 500) throw new Error('Limite de 500 itens internos.');
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      total += chunk.length;
      if (total > maxBytes) { file.terminate(); throw new Error('Limite real de descompactação excedido.'); }
      if (final) completed++;
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < data.length; offset += 4096) unzip.push(data.subarray(offset, offset + 4096), offset + 4096 >= data.length);
  if (!entries || entries !== completed) throw new Error('Arquivo ZIP incompleto.');
}
export async function readRuleWorkbook(file: File): Promise<{ sheets: RuleSheet[]; sha256: string }> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024 || !file.size) throw new Error('Envie um arquivo XLSX de até 2 MB.');
  const data = await file.arrayBuffer();
  checkWorkbookZip(data);
  verifyZipPayload(new Uint8Array(data));
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  if (workbook.worksheets.length > 20) throw new Error('Limite de 20 abas.');
  const sheets = workbook.worksheets.map(sheet => {
    if (sheet.rowCount > 1020 || sheet.columnCount > 50) throw new Error(`Aba ${sheet.name}: limite de 1.020 linhas e 50 colunas.`);
    const cells: string[][] = [];
    for (let row = 1; row <= sheet.rowCount; row++) {
      const values: string[] = [];
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cell = sheet.getCell(row, col);
        if (cell.type === ExcelJS.ValueType.Formula) throw new Error(`Aba ${sheet.name}, ${cell.address}: fórmulas não são importadas. Envie valores fixos.`);
        if (cell.type === ExcelJS.ValueType.Error) throw new Error(`Aba ${sheet.name}, ${cell.address}: célula com erro.`);
        // Preserve formatted numeric identifiers, e.g. 000123, where supplied.
        const value = typeof cell.value === 'number' && /^0+$/.test(cell.numFmt)
          ? String(cell.value).padStart(cell.numFmt.length, '0') : cell.text;
        if (value.length > 4000) throw new Error(`Aba ${sheet.name}, ${cell.address}: texto muito longo.`);
        values.push(value);
      }
      cells.push(values);
    }
    return { name: sheet.name, cells };
  });
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
  return { sheets, sha256 };
}
export function previewRuleSheet(sheet: RuleSheet, fileName: string) { return parseRuleSheet(sheet.cells, fileName, sheet.name); }
