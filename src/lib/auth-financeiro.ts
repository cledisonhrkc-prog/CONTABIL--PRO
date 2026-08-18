/**
 * Helper de autenticação para o módulo financeiro.
 *
 * IMPORTANTE — sem fallback de empresa:
 * Diferente de getEmpresaAtiva() (usada pelo resto do sistema, que cai pra
 * "primeira empresa do banco" quando o admin não selecionou nenhuma), o
 * módulo financeiro NUNCA escolhe empresa sozinho. Se não houver o cookie
 * "empresa_ativa_id" explicitamente setado (via /api/selecionar-empresa),
 * a operação é recusada — tanto leitura quanto escrita. Dinheiro real
 * não pode ser gravado (ou mostrado) na empresa errada por acidente.
 */

import { cookies } from "next/headers";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";

export type AuthContext = {
  empresaId: number;
  usuarioId: number;
  email?: string;
};

export class AuthError extends Error {
  status: number;
  constructor(message = "Não autenticado", status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Retorna o contexto autenticado (usuário + empresa EXPLICITAMENTE
 * selecionada) ou lança AuthError. Nunca escolhe empresa sozinho.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const usuario = await usuarioAtual();
  if (!usuario) {
    throw new AuthError("Não autenticado.", 401);
  }

  const cookieStore = await cookies();
  const escolhidaStr = cookieStore.get("empresa_ativa_id")?.value;

  if (!escolhidaStr) {
    throw new AuthError(
      "Nenhuma empresa selecionada. Selecione uma empresa antes de continuar — o módulo financeiro nunca escolhe uma empresa automaticamente.",
      400
    );
  }

  const empresaId = Number(escolhidaStr);
  if (!empresaId || Number.isNaN(empresaId)) {
    throw new AuthError("Empresa selecionada inválida. Selecione uma empresa novamente.", 400);
  }

  const permitidos = await empresasPermitidasIds(usuario);
  const permitido = permitidos === null || permitidos.includes(empresaId);
  if (!permitido) {
    throw new AuthError("Você não tem permissão para acessar esta empresa.", 403);
  }

  return {
    empresaId,
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
      return Response.json({ error: e.message }, { status: e.status });
    }
    return Response.json(
      { error: e.message || "Erro interno" },
      { status: e.status || 400 }
    );
  }
}
