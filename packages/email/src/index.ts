// Factory do domínio email — o ÚNICO import que o app faz deste package.
// Barrel = ZONA NEUTRA (Integrador sincroniza no reconcile).
//
// Este package é o EXEMPLO CANÔNICO do adapter pattern (STACK-DEFAULT §1).
// Integração externa nova (storage, whatsapp, payment, llm...) replica esta
// estrutura: types.ts (porta) + adapters/{dev,<vendor>}.ts + index.ts (factory).

import { DevEmailAdapter } from './adapters/dev.ts';
import { ResendEmailAdapter } from './adapters/resend.ts';
import type { EmailProvider } from './types.ts';

export type { EmailProvider, SendEmailInput, SendEmailResult } from './types.ts';

export interface CreateEmailOpts {
  /** Sem apiKey → adapter dev (console). Teste SEMPRE cai aqui (credenciais neutralizadas). */
  resendApiKey?: string;
  defaultFrom?: string;
}

export function createEmail(opts: CreateEmailOpts = {}): EmailProvider {
  if (opts.resendApiKey) {
    return new ResendEmailAdapter(opts.resendApiKey, opts.defaultFrom ?? 'no-reply@example.com');
  }
  return new DevEmailAdapter();
}
