import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { emptyFicha } from '@app/shared';
import { FichaForm } from './FichaForm';
import { BackupSchema, readImage, RecordSchema } from './storage';
import { DocumentPreview } from './DocumentPreview';
describe('Revisão e entrada de fichas', () => {
  it('mantém rótulos fixos e encaminha a edição sem alterar outros campos', () => {
    const change = vi.fn();
    render(<FichaForm ficha={emptyFicha()} disabled={false} onChange={change} onColorsChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '01.14.01.3221' } });
    expect(change).toHaveBeenCalledWith('reference', '01.14.01.3221');
    expect(screen.getByLabelText('Composição')).toHaveValue('');
  });
  it('edita cores separadas sem renumerar as restantes', () => {
    const colors = [{ number: '02', name: 'Navy', pantone: '17-4015', code: 'MC 7064035' }, { number: '07', name: 'White', pantone: '11-0601', code: 'MC 791510' }];
    const change = vi.fn();
    render(<FichaForm ficha={{ ...emptyFicha(), colors }} disabled={false} onChange={vi.fn()} onColorsChange={change} />);
    fireEvent.change(screen.getByLabelText('Pantone — cor 2'), { target: { value: '11-0602' } });
    expect(change).toHaveBeenLastCalledWith([colors[0], { ...colors[1], pantone: '11-0602' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remover cor 02' }));
    expect(change).toHaveBeenLastCalledWith([colors[1]]);
  });
  it('imprime MODELAGEM, ETIQUETA, cores em tabela e quatro aviamentos', () => {
    const record = RecordSchema.parse({ id: 'print', updatedAt: new Date().toISOString(), image: '', fileName: '', example: false, warnings: [], ficha: { ...emptyFicha(), modeling: 'Top MC D.200', season: 'WINTER I 2027', labelCode: 'CFC', colors: [{ number: '02', name: 'Skyway', pantone: '14-4112', code: 'MC 4060288' }], print: 'Estampa frente', embroidery: 'Bordado costas', applique: 'Aplique manga', trim1: 'Tag BCI', trim4: 'Selo detalhe interativo' } });
    render(<DocumentPreview record={record} />);
    expect(screen.getAllByText('Top MC D.200').length).toBeGreaterThan(0);
    expect(screen.getByText('ETIQUETA')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cores' })).toHaveTextContent('MC 4060288');
    expect(screen.getByText('Aviamento 4')).toBeInTheDocument();
    expect(screen.getByText('Selo detalhe interativo')).toBeInTheDocument();
  });
  it('bloqueia arquivos não suportados e acima de 10 MB', async () => {
    await expect(readImage(new File(['x'], 'x.pdf', { type: 'application/pdf' }))).rejects.toThrow('PNG');
    await expect(readImage(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow('10 MB');
  });
  it('rejeita backups com campos desconhecidos ou sem contrato completo', () => {
    expect(BackupSchema.safeParse({ version: 1, fichas: [{ ficha: { reference: '123' } }] }).success).toBe(false);
    expect(BackupSchema.safeParse({ version: 1, fichas: [], other: true }).success).toBe(false);
  });
  it('rejeita conteúdo corrompido mesmo quando declara MIME PNG', async () => {
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal('Image', BrokenImage);
    try { await expect(readImage(new File(['não é png'], 'falsa.png', { type: 'image/png' }))).rejects.toThrow('corrompida'); } finally { vi.unstubAllGlobals(); }
  });
  it('preserva a data URL original depois de decodificar a imagem', async () => {
    class ValidImage {
      naturalWidth = 10;
      naturalHeight = 20;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', ValidImage);
    try { await expect(readImage(new File(['png'], 'ficha.png', { type: 'image/png' }))).resolves.toBe('data:image/png;base64,cG5n'); } finally { vi.unstubAllGlobals(); }
  });
});
