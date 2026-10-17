import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HomeClient from '../../home-client';
vi.mock('@/lib/queries/fichas', () => ({ useFichaConfig: () => ({ isPending: false, isFetching: false, isError: false, data: { configured: true, provider: 'codex' }, refetch: vi.fn() }), useExtractFicha: () => ({ isPending: false, mutateAsync: vi.fn() }) }));
vi.mock('./storage', async () => { const original = await vi.importActual<typeof import('./storage')>('./storage'); return { ...original, listRecords: vi.fn().mockResolvedValue([]) }; });
describe('Edição transitória de rascunho no HomeClient', () => {
  it('mantém formulário ao apagar e redigitar cor e nome no campo único', async () => {
    render(<HomeClient />);
    fireEvent.click(await screen.findByRole('button', { name: 'Preencher manualmente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar cor' }));
    const input = screen.getByLabelText('Cor e nome — cor 1');
    expect(input).toHaveValue('Cor 01');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByLabelText('Cor e nome — cor 1')).toHaveValue('');
    expect(screen.getByRole('region', { name: 'Revisão da ficha' })).toBeInTheDocument();
    let draft = '';
    for (const character of 'Cor 03 - Bright White') {
      draft += character;
      fireEvent.change(input, { target: { value: draft } });
      expect(input).toHaveValue(draft);
    }
    expect(input).toHaveValue('Cor 03 - Bright White');
    fireEvent.blur(input);
    expect(screen.queryByText('Atualizando seu espaço de trabalho sem descartar o rascunho…')).not.toBeInTheDocument();
  });
  it('edita grupos antigos sem duplicar seus valores e reflete a mudança na prévia', async () => {
    render(<HomeClient />);
    fireEvent.click(await screen.findByRole('button', { name: 'Preencher manualmente' }));
    const client = await screen.findByLabelText('Cliente / marca / coleção / estação / ano');
    fireEvent.change(client, { target: { value: 'C&A — BABY CLUB — WINTER I 2027' } });
    fireEvent.change(screen.getByLabelText('Costuras e bainhas'), { target: { value: 'Pesponto 1ag; bainha 2ag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prévia da ficha' }));
    expect(screen.getAllByText('Pesponto 1ag; bainha 2ag').length).toBeGreaterThan(0);
    expect(screen.getAllByText('C&A — BABY CLUB — WINTER I 2027').length).toBeGreaterThan(0);
    expect(screen.queryByText('Estilista')).not.toBeInTheDocument();
  });
});
