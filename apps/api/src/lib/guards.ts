// Guards de autorização. ZONA NEUTRA — guards novos entram via Integrador.
//
// REGRA INEGOCIÁVEL (ADR 003 / projeto-origem): autorização acontece AQUI, no
// backend. UI esconder botão é UX, não segurança — nenhum gate é só de interface.
//
// Better Auth entra no milestone de backend real (a DESIGN-SPEC do slot de auth
// define os guards concretos). O padrão fica assim:
//
//   export async function getSession(request: FastifyRequest): Promise<Session> {
//     // valida cookie/token via Better Auth; lança UnauthorizedError se inválido
//   }
//
//   export function requireRole(session: Session, role: Role): void {
//     // lança ForbiddenError se o papel não cobre
//   }
//
// Se o projeto for MULTI-TENANT (decidido no kickoff), TODO guard resolve também
// o workspace: query sem filtro de workspaceId é bug de segurança, não estilo.

export {};
