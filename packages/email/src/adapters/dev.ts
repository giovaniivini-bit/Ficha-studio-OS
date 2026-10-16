// Adapter DEV — todo domínio de integração tem um. Não bate em serviço nenhum:
// loga no console e devolve sucesso. É o que roda em teste (vitest neutraliza as
// credenciais reais → factory cai aqui) e em dev sem chave configurada.
// Lição (os-v2 / LEARNINGS 1.19): sem adapter dev, teste vaza pra provedor real.

import type { EmailProvider, SendEmailInput, SendEmailResult } from '../types.ts';

export class DevEmailAdapter implements EmailProvider {
  private counter = 0;

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.counter += 1;
    // eslint-disable-next-line no-console
    console.log(`[email:dev] → ${input.to} | ${input.subject}`);
    return { id: `dev-${this.counter}`, provider: 'dev' };
  }
}
