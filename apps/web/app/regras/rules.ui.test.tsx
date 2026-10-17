import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RulesClient from './rules-client';
import { approveCatalog, listCatalogs } from '@/lib/rules/storage';

vi.mock('@/lib/rules/storage', () => ({ listCatalogs: vi.fn(), approveCatalog: vi.fn() }));
vi.mock('@/lib/rules/import-xlsx', async () => {
  const { parseRuleSheet } = await import('@/lib/rules/catalog');
  return { readRuleWorkbook: vi.fn().mockResolvedValue({ sheets: [{ name: 'Malhas', cells: [['MALHA', 'codigo', 'gramatura'], ['ribana 2x1', '001', '255'], ['ribana 2x1', '002', '245']] }], sha256: 'a'.repeat(64) }), previewRuleSheet: (sheet: { name: string; cells: string[][] }, name: string) => parseRuleSheet(sheet.cells, name, sheet.name) };
});
beforeEach(() => { vi.mocked(listCatalogs).mockResolvedValue([]); vi.mocked(approveCatalog).mockReset(); });
describe('Tela Regras', () => {
  it('só salva depois de conferir e aprovar explicitamente', async () => {
    render(<RulesClient />);
    const input = screen.getByLabelText('Importar planilha de malhas');
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { files: [new File(['xlsx'], 'malhas.xlsx')] } });
    const approve = await screen.findByRole('button', { name: 'Aprovar e salvar catálogo' });
    expect(approve).toBeDisabled();
    expect(approveCatalog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(approve).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nome da malha — código 002'), { target: { value: 'ribana 1x1' } });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(approve);
    await waitFor(() => expect(approveCatalog).toHaveBeenCalledOnce());
    expect(vi.mocked(approveCatalog).mock.calls[0]![0].rules).toHaveLength(2);
    expect(vi.mocked(approveCatalog).mock.calls[0]![0].rules[1]).toMatchObject({ name: 'ribana 1x1', sourceName: 'ribana 2x1' });
  });
  it('mostra todas as opções ambíguas sem escolher uma', async () => {
    const { parseRuleSheet } = await import('@/lib/rules/catalog');
    const rules = parseRuleSheet([['MALHA', 'codigo'], ['ribana 2x1', '001'], ['ribana 2x1', '002']], 'm.xlsx', 'A').rules;
    vi.mocked(listCatalogs).mockResolvedValue([{ id: crypto.randomUUID(), version: 1, sourceSha256: 'a'.repeat(64), approvedAt: new Date().toISOString(), rules }]);
    render(<RulesClient />);
    fireEvent.change(await screen.findByLabelText('Nome completo ou código da malha'), { target: { value: 'ribana 2x1' } });
    expect(screen.getByText(/Há 2 opções/)).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});
