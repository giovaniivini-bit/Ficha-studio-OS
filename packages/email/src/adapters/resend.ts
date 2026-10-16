// Adapter Resend — implementação real da porta.
// Usa fetch direto (sem SDK) de propósito: mostra que o vendor fica 100%
// encapsulado aqui. Trocar pra SDK oficial ou pra outro vendor (SendGrid, SES)
// = novo arquivo de adapter + 1 case no factory. Nada mais muda no app.

import type { EmailProvider, SendEmailInput, SendEmailResult } from '../types.ts';

export class ResendEmailAdapter implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
  ) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from ?? this.defaultFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`resend respondeu ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { id: string };
    return { id: data.id, provider: 'resend' };
  }
}
