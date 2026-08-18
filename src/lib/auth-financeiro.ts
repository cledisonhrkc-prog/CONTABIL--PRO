/**
 * Helper de autenticação para o módulo financeiro.
 * Reaproveita a sessão real do Contábil Pro (src/lib/auth.ts + src/lib/empresa.ts):
 *   - usuarioAtual()    -> lê o cookie "sessao", valida o token HMAC, retorna { id, email, admin }
 *   - getEmpresaAtiva() -> resolve a empresa ativa (cookie "empresa_ativa_id" + permissões)
 *
 * empresaId e usuarioId SEMPRE vêm daqui — nunca do body ou query string
 * enviados pelo cliente.
 */

import { usuarioAtual, getEmpresaAtiva } from "@/lib/empresa";

export type AuthContext = {
  empresaId: number;
  usuarioId: number;
  email?: string;
};

export class AuthError extends Error {
  status = 401;
  constructor(message = "Não autenticado") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Retorna o contexto autenticado (usuário + empresa ativa) ou lança AuthError.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const usuario = await usuarioAtual();
  if (!usuario) {
    throw new AuthError("Não autenticado");
  }

  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    throw new AuthError(
      "Nenhuma empresa selecionada ou sem permissão de acesso. Selecione uma empresa antes de continuar."
    );
  }

  return {
    empresaId: empresa.id,
    usuarioId: usuario.id,
    email: usuario.email,
  };
}

/**
 * Wrapper para rotas API: pega auth, executa handler, trata erros.
 */
export async function withAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>
): Promise<Response> {
  try {
    const ctx = await getAuthContext();
    const result = await handler(ctx);
    return Response.json(result);
  } catch (e: any) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: 401 });
    }
    return Response.json(
      { error: e.message || "Erro interno" },
      { status: e.status || 400 }
    );
  }
}
