import { it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { emptyFicha } from '@app/shared';
import { DocumentPreview } from './DocumentPreview';
import { RecordSchema } from './storage';
import { approveReading, completeEnrichment } from '../../../lib/workflow/flow';

it('organiza identificação, materiais e aviamentos em tabelas sem inventar dados secundários', () => {
  const record = RecordSchema.parse({ id: 'layout', updatedAt: new Date().toISOString(), image: '', fileName: '', warnings: [], example: false, ficha: { ...emptyFicha(), reference: 'REF123', secondaryCode: 'SEC456', sizes: '1 ao 5', modeling: 'Top MC', labelCode: 'CFC', mainMaterial: 'Meia malha (código 333)', composition: '100% algodão', weight: '155', complementaryMaterials: 'Ribana 2x1', trim1: 'TAG BCI CÓD. TC 02/5683', print: 'Estampa frontal' } });
  render(<DocumentPreview record={record} />);
  const identification = screen.getByRole('table', { name: 'Identificação — referências' });
  expect(within(identification).getByText('REF123')).toBeInTheDocument();
  expect(within(identification).getByText('SEC456')).toBeInTheDocument();
  const materials = screen.getByRole('table', { name: 'Materiais' });
  expect(within(materials).getByText('333')).toBeInTheDocument();
  expect(within(materials).getByText('Ribana 2x1').closest('tr')).not.toHaveTextContent('100% algodão');
  const trims = screen.getByRole('table', { name: 'Aviamentos' });
  expect(within(trims).getByText('TC 02/5683')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Estampas' })).toBeInTheDocument();
});

it('não reintroduz observações da planilha que o usuário rejeitou', () => {
  const ficha = { ...emptyFicha(), mainMaterial: 'Malha (código 333)', notes: 'Manter observação original' };
  const rule = { name: 'Malha', code: '333', composition: '', weight: '', width: '1,8m', notes: 'Nota rejeitada', source: { file: 'teste.xlsx', sheet: 'Malhas', row: 2 } };
  const workflow = completeEnrichment(approveReading(ficha, 'manual'), ficha, { rule, decisions: { notes: 'keep' }, skipped: false });
  const record = RecordSchema.parse({ id: 'kept-notes', updatedAt: new Date().toISOString(), image: '', fileName: '', warnings: [], example: false, ficha, workflow });
  render(<DocumentPreview record={record} />);
  expect(screen.queryByText('Nota rejeitada')).not.toBeInTheDocument();
  expect(screen.queryByText(/Largura: 1,8m/)).not.toBeInTheDocument();
  expect(screen.getByText('Manter observação original')).toBeInTheDocument();
});

it('mostra código e observações da malha e dados próprios da ribana após aprovação', () => {
  const ficha = { ...emptyFicha(), mainMaterial: 'Malha', composition: '100% co', weight: '155', notes: 'Observações da malha: Fio principal', complementaryMaterials: 'Ribana 2x1 na cor 02' };
  const source = { file: 'teste.xlsx', sheet: 'Malhas', row: 2 };
  const rule = { name: 'Malha', code: '333', composition: '100% co', weight: '155', width: '', notes: 'Fio principal', source };
  const secondaryRule = { ...rule, name: 'Ribana 2x1', code: '1123343', composition: '97% co 3% oue', weight: '255', notes: 'Nota da ribana' };
  const workflow = completeEnrichment(approveReading(ficha, 'manual'), ficha, { rule, secondaryRule, decisions: {}, skipped: false });
  const record = RecordSchema.parse({ id: 'secondary-preview', updatedAt: new Date().toISOString(), image: '', fileName: '', warnings: [], example: false, ficha, workflow });
  render(<DocumentPreview record={record} />);
  const table = within(screen.getByRole('table', { name: 'Materiais' }));
  expect(table.getByText('333')).toBeInTheDocument();
  expect(table.getByText('Fio principal')).toBeInTheDocument();
  const row = table.getByText('Ribana 2x1 na cor 02').closest('tr')!;
  expect(row).toHaveTextContent('1123343');
  expect(row).toHaveTextContent('255');
  expect(row).toHaveTextContent('97% co 3% oue');
  expect(row).toHaveTextContent('Nota da ribana');
});
