import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { emptyFicha } from '@app/shared';
import { FichaForm } from './FichaForm';
import { fieldUpdates, parseColorTitle } from './field-presentation';
import { DocumentPreview } from './DocumentPreview';
import { RecordSchema } from './storage';

describe('Campos agrupados', () => {
  it('preserva os valores antigos em campos únicos, sem estilista', () => {
    render(<FichaForm ficha={{ ...emptyFicha(), client: 'C&A', collection: 'BABY CLUB', season: 'WINTER I 2027', designer: 'Camila', seams: 'Pesponto 1ag', hems: 'Bainha 2ag' }} disabled={false} onChange={vi.fn()} onColorsChange={vi.fn()} />);
    expect(screen.getByLabelText('Cliente / marca / coleção / estação / ano')).toHaveValue('C&A — BABY CLUB — WINTER I 2027');
    expect(screen.getByLabelText('Costuras e bainhas')).toHaveValue('Pesponto 1ag\nBainha 2ag');
    expect(screen.queryByLabelText('Estilista')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estação / ano')).not.toBeInTheDocument();
    expect(fieldUpdates('client', 'Novo cabeçalho')).toEqual({ client: 'Novo cabeçalho', collection: '', season: '' });
    expect(fieldUpdates('seams', 'Bainha nova')).toEqual({ seams: 'Bainha nova', hems: '' });
  });
  it('edita número e nome juntos, preservando Pantone e código', () => {
    const color = { number: '01', name: 'Bright White', pantone: '11-0601', code: 'MC 791510' };
    const change = vi.fn();
    render(<FichaForm ficha={{ ...emptyFicha(), colors: [color] }} disabled={false} onChange={vi.fn()} onColorsChange={change} />);
    const input = screen.getByLabelText('Cor e nome — cor 1');
    expect(input).toHaveValue('Cor 01 - Bright White');
    fireEvent.change(input, { target: { value: 'Cor 03 - Skyway' } });
    expect(change).toHaveBeenLastCalledWith([{ ...color, number: '03', name: 'Skyway' }]);
    expect(screen.queryByLabelText('Número — cor 1')).not.toBeInTheDocument();
    expect(parseColorTitle('', color).number).toBe('01');
    expect(parseColorTitle('Cor A01 - Navy Blue', { ...color, number: 'A01' })).toEqual({ ...color, number: 'A01', name: 'Navy Blue' });
  });
  it('agrupa os campos antigos também na impressão sem alterar o registro', () => {
    const ficha = { ...emptyFicha(), client: 'C&A', collection: 'BABY CLUB', season: 'WINTER I 2027', designer: 'Camila', seams: 'Pesponto 1ag', hems: 'Bainha 2ag', colors: [{ number: '02', name: 'Skyway', pantone: '14-4112', code: 'MC 123' }] };
    const record = RecordSchema.parse({ id: 'print-grouped', updatedAt: new Date().toISOString(), image: '', fileName: '', example: false, warnings: [], ficha });
    render(<DocumentPreview record={record} />);
    expect(screen.getAllByText('C&A — BABY CLUB — WINTER I 2027').length).toBeGreaterThan(0);
    expect(screen.getByText(/Pesponto 1ag\s+Bainha 2ag/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cores' })).toHaveTextContent('Cor 02 - Skyway');
    expect(screen.queryByText('Estilista')).not.toBeInTheDocument();
    expect(record.ficha).toEqual(ficha);
  });
});
