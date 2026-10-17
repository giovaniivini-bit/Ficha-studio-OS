import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { emptyFicha } from '@app/shared';
import { DocumentPreview } from './DocumentPreview';
import { RecordSchema } from './storage';

describe('Prévia sem campos ausentes', () => {
  it('oculta vazios, espaços e marcadores explícitos, sem alterar dados', () => {
    const record = RecordSchema.parse({ id: 'empty-preview', updatedAt: new Date().toISOString(), image: '', fileName: '', example: false, warnings: [], ficha: { ...emptyFicha(), mainMaterial: 'Malha penteada', composition: 'Não informado', weight: '   ', seams: 'NÃO INFORMADO', hems: 'Bainha 2ag', trim3: ' não informado ' } });
    const original = JSON.stringify(record);
    render(<DocumentPreview record={record} />);
    expect(screen.getByText('Malha penteada')).toBeInTheDocument();
    expect(screen.getByText('Bainha 2ag')).toBeInTheDocument();
    expect(screen.queryByText('Composição')).not.toBeInTheDocument();
    expect(screen.queryByText('Gramatura')).not.toBeInTheDocument();
    expect(screen.queryByText('Aplicações e aviamentos')).not.toBeInTheDocument();
    expect(screen.queryByText('Medidas indicadas')).not.toBeInTheDocument();
    expect(screen.queryByText(/não informado/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Cores')).not.toBeInTheDocument();
    expect(JSON.stringify(record)).toBe(original);
  });
  it('mantém cores existentes e omite colunas inteiramente ausentes', () => {
    const record = RecordSchema.parse({ id: 'colors-preview', updatedAt: new Date().toISOString(), image: '', fileName: '', example: false, warnings: [], ficha: { ...emptyFicha(), colors: [{ number: '01', name: 'Skyway', pantone: 'Não informado', code: '' }] } });
    render(<DocumentPreview record={record} />);
    expect(screen.getByRole('table')).toHaveTextContent('Cor 01 - Skyway');
    expect(screen.queryByRole('columnheader', { name: 'Pantone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Código' })).not.toBeInTheDocument();
    expect(screen.queryByText(/não informado/i)).not.toBeInTheDocument();
  });
  it('não cria identificação de cor quando só o Pantone está disponível', () => {
    const record = RecordSchema.parse({ id: 'pantone-preview', updatedAt: new Date().toISOString(), image: '', fileName: '', example: false, warnings: [], ficha: { ...emptyFicha(), colors: [{ number: 'Não informado', name: '', pantone: '14-4112', code: '' }] } });
    render(<DocumentPreview record={record} />);
    expect(screen.getByRole('table')).toHaveTextContent('14-4112');
    expect(screen.queryByRole('columnheader', { name: 'Cor e nome' })).not.toBeInTheDocument();
  });
});
