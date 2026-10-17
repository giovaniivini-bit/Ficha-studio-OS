import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { emptyFicha } from '@app/shared';
import { FichaWorkflow } from './FichaWorkflow';
import { RecordSchema, type FichaRecord } from './storage';
import { listCatalogs } from '@/lib/rules/storage';
import { approveReading, completeEnrichment, approveFinal, finishSaved } from '@/lib/workflow/flow';

vi.mock('@/lib/rules/storage', () => ({ listCatalogs: vi.fn() }));
function Harness({ failSave = false }: { failSave?: boolean }) {
  const [record, setRecord] = useState<FichaRecord>(() => RecordSchema.parse({ id: 'test-flow', updatedAt: new Date().toISOString(), fileName: '', image: '', ficha: emptyFicha(), warnings: [], example: false }));
  return <FichaWorkflow record={record} disabled={false} aiAvailable={false} onRecordChange={setRecord} onUpload={vi.fn()} onExtract={vi.fn()} onSaveFinal={async next => { if (failSave) return false; setRecord(next); return true; }} />;
}
function setupCatalog() {
  vi.mocked(listCatalogs).mockResolvedValue([{ version: 1, id: 'ab64af28-93e6-4d26-814b-ea4d0d96aed0', approvedAt: new Date().toISOString(), sourceSha256: 'a'.repeat(64), rules: [{ name: 'meia malha penteada', composition: '100% co', code: '145', weight: '155', width: '1,8m', notes: 'fio nacional', source: { file: 'm.xlsx', sheet: 'Malhas', row: 2 } }] }]);
}
async function readingToRules() {
  fireEvent.click(screen.getByRole('button', { name: 'Preencher manualmente' }));
  fireEvent.change(screen.getByLabelText('Material principal'), { target: { value: 'meia malha penteada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar leitura e consultar regras' }));
  await screen.findByLabelText('Decisão — Material principal');
}
describe('Trilha completa da ficha', () => {
  it('completa leitura, aplica regras, aprova e salva; voltar não perde dados', async () => {
    setupCatalog(); render(<Harness />);
    expect(screen.getByRole('button', { name: /6.*Ficha salva/ })).toBeDisabled();
    await readingToRules();
    expect(screen.getByRole('button', { name: 'Aplicar decisões e avançar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Decisão — Material principal'), { target: { value: 'rule' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar decisões e avançar' }));
    const document = screen.getByRole('article', { name: 'Ficha técnica para impressão' });
    expect(within(document).getByText('100% co')).toBeInTheDocument();
    expect(document.closest('.preview-surface')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Aprovar e salvar ficha final' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /3.*Revisão/ }));
    expect(screen.getByLabelText('Material principal')).toHaveValue('meia malha penteada');
    fireEvent.click(screen.getByRole('button', { name: /5.*Aprovação final/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Conferi a ficha final/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar e salvar ficha final' }));
    await screen.findByText('Ficha final salva');
  });
  it('invalidates later approvals when approved reading changes', async () => {
    setupCatalog(); render(<Harness />); await readingToRules();
    fireEvent.click(screen.getByRole('button', { name: /3.*Revisão/ }));
    fireEvent.change(screen.getByLabelText('Composição'), { target: { value: '50% co' } });
    expect(screen.getByRole('button', { name: /4.*Regras/ })).toBeDisabled();
    expect(screen.getByLabelText('Composição')).toHaveValue('50% co');
  });
  it('preserva as decisões parciais ao voltar e pode salvar o rascunho do fluxo', async () => {
    setupCatalog(); render(<Harness />); await readingToRules();
    fireEvent.change(screen.getByLabelText('Decisão — Material principal'), { target: { value: 'keep' } });
    fireEvent.click(screen.getByRole('button', { name: /3.*Revisão/ }));
    fireEvent.click(screen.getByRole('button', { name: /4.*Regras/ }));
    expect(screen.getByLabelText('Decisão — Material principal')).toHaveValue('keep');
    fireEvent.change(screen.getByLabelText('Decisão — Material principal'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Aplicar decisões e avançar' })).toBeDisabled();
  });
  it('reabre ficha final sem complementos sem invalidar sua aprovação', async () => {
    setupCatalog();
    const ficha = { ...emptyFicha(), mainMaterial: 'meia malha penteada' };
    const workflow = finishSaved(approveFinal(completeEnrichment(approveReading(ficha, 'manual'), ficha, { decisions: {}, skipped: true })));
    const record = RecordSchema.parse({ id: 'skipped', updatedAt: new Date().toISOString(), fileName: '', image: '', ficha, workflow, warnings: [], example: false });
    const change = vi.fn();
    render(<FichaWorkflow record={record} disabled={false} aiAvailable={false} onRecordChange={change} onUpload={vi.fn()} onExtract={vi.fn()} onSaveFinal={vi.fn()} />);
    await waitFor(() => expect(screen.queryByText('Consultando catálogo aprovado…')).not.toBeInTheDocument());
    expect(screen.getByText('Ficha final salva')).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
  it('never marks saved when persistence fails', async () => {
    setupCatalog(); render(<Harness failSave />); await readingToRules();
    fireEvent.change(screen.getByLabelText('Decisão — Material principal'), { target: { value: 'keep' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar decisões e avançar' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Conferi a ficha final/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar e salvar ficha final' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar'));
    expect(screen.queryByText('Ficha final salva')).not.toBeInTheDocument();
  });
});
