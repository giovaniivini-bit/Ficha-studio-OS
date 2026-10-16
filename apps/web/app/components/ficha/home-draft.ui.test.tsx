import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HomeClient from '../../home-client';
vi.mock('@/lib/queries/fichas', () => ({ useFichaConfig: () => ({ isPending: false, isFetching: false, isError: false, data: { configured: true, provider: 'codex' }, refetch: vi.fn() }), useExtractFicha: () => ({ isPending: false, mutateAsync: vi.fn() }) }));
vi.mock('./storage', async () => { const original = await vi.importActual<typeof import('./storage')>('./storage'); return { ...original, listRecords: vi.fn().mockResolvedValue([]) }; });
describe('Edição transitória de rascunho no HomeClient', () => {
  it('mantém formulário ao apagar e redigitar o número de uma cor', async () => {
    render(<HomeClient />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar cor' }));
    const input = screen.getByLabelText('Número — cor 1');
    expect(input).toHaveValue('01');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByLabelText('Número — cor 1')).toHaveValue('');
    expect(screen.getByRole('region', { name: 'Revisão da ficha' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Número — cor 1'), { target: { value: '03' } });
    expect(screen.getByLabelText('Número — cor 1')).toHaveValue('03');
    expect(screen.queryByText('Atualizando seu espaço de trabalho sem descartar o rascunho…')).not.toBeInTheDocument();
  });
});
