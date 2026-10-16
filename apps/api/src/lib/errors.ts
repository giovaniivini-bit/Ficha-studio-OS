// Erros tipados do app. ZONA NEUTRA — subclasse nova entra via Integrador.
//
// Lição (LEARNINGS projeto-origem): membros que colidem com nativos de Error
// (`cause`, `message`, `name`, `stack`) exigem `override` com noImplicitOverride.
// Aqui evitamos o problema passando `cause` direto pro construtor nativo (ES2022).

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(
    message: string,
    opts: { statusCode?: number; code?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = new.target.name;
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code ?? 'internal_error';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', cause?: unknown) {
    super(message, { statusCode: 400, code: 'validation_error', cause });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(message, { statusCode: 401, code: 'unauthorized' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Sem permissão') {
    super(message, { statusCode: 403, code: 'forbidden' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, { statusCode: 404, code: 'not_found' });
  }
}
