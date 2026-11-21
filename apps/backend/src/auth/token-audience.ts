/**
 * Os JWT assinados com o JWT_SECRET levam sempre uma audience que diz para que servem.
 * O state do OAuth do Google era assinado com o mesmo segredo e sem marca nenhuma: posto
 * no cookie de sessão, o JwtStrategy aceitava-o, sem `sub`, e com `userId: undefined` o
 * Prisma ignorava o filtro e devolvia os dados de todos os utilizadores.
 */
export const SESSION_AUDIENCE = 'session';
export const GOOGLE_OAUTH_STATE_AUDIENCE = 'google-oauth-state';
