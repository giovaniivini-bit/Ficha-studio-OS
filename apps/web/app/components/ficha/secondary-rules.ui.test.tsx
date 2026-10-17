import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { emptyFicha } from '@app/shared';
import { RulesEnrichment } from './RulesEnrichment';
import { approveReading } from '../../../lib/workflow/flow';
import { listCatalogs } from '../../../lib/rules/storage';
vi.mock('../../../lib/rules/storage', () => ({ listCatalogs: vi.fn() }));
it('seleciona ribana 2x1, mostra dados da planilha e envia snapshot na aprovação', async () => {
  const rule = { name: 'Ribana 2x1', code: '1123343', composition: '97% co', weight: '255', width: '1m', notes: 'Nota da ribana', source: { file: 'malhas.xlsx', sheet: 'Malhas', row: 3 } };
  vi.mocked(listCatalogs).mockResolvedValue([{ version: 1, id: 'ab64af28-93e6-4d26-814b-ea4d0d96aed0', approvedAt: new Date().toISOString(), sourceSha256: 'a'.repeat(64), rules: [rule] }]);
  const ficha = { ...emptyFicha(), complementaryMaterials: 'Ribana 2x1 na cor 02' };
  const onContinue = vi.fn(); const onDraftChange = vi.fn();
  render(<RulesEnrichment workflow={approveReading(ficha, 'manual')} disabled={false} onContinue={onContinue} onDraftChange={onDraftChange} />);
  await screen.findByText('Nota da ribana', { exact: false });
  expect(screen.getByLabelText('Material secundário selecionado no catálogo')).toHaveValue('1123343');
  expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ secondaryCode: '1123343' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar decisões e avançar' }));
  expect(onContinue).toHaveBeenCalledWith(ficha, expect.objectContaining({ secondaryRule: rule, skipped: false }));
});
