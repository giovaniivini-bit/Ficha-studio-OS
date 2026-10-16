// MODELO de smoke de UI test-first (Vitest + Testing Library + happy-dom): renderiza um
// componente, clica no gatilho e prova que o handler/mutation foi chamado — SEM browser,
// roda em milissegundos. Os slots de tela copiam este padrão em
// `app/<grupo>/<rota>/<rota>.ui.test.tsx`: clica em "Novo X" → confirma o modal → submete →
// prova a mutation (hook mockado). Botão morto = RED; ligar o fluxo = GREEN.
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('infra de UI: renderiza, clica no gatilho e dispara o handler', async () => {
  const onNew = vi.fn();
  render(<button onClick={onNew}>Novo lead</button>);
  await userEvent.click(screen.getByRole('button', { name: 'Novo lead' }));
  expect(onNew).toHaveBeenCalledOnce();
});
