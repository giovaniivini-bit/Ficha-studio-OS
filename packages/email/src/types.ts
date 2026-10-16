// PORTA do domínio email — a interface que o app consome.
// REGRA (ADR 002 + ADR 008 do projeto-origem):
//   1. Consumidor NUNCA importa SDK/API de vendor — só esta interface via factory.
//   2. A porta NUNCA importa @app/shared nem tipos de domínio do produto —
//      ela é agnóstica e reutilizável fora deste projeto. Quem traduz
//      DTO ↔ porta é o módulo consumidor (tradução mecânica).

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  id: string;
  provider: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
