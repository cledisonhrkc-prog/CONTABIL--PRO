/**
 * Helper de autenticação para o módulo financeiro.
 * 
 * ADAPTE esta função para o sistema de auth real do Contábil Pro.
 * Exemplos comuns:
 *   - NextAuth: const session = await getServerSession(authOptions)
 *   - Clerk: const { userId } = await auth()
 *   - Cookie próprio: cookies().get("session")
 * 
 * O importante: empresaId e usuarioId DEVEM vir da sessão autenticada,
 * NUNCA do body ou query string enviados pelo cliente.
 */

// Importe aqui a função de sessão real do projeto, ex:
// import { getSessaoAtual } from "@/lib/auth";

export type AuthContext = {
  empresaId: number;
  usuarioId: number;
  email?: string;
};

/**
 * Retorna o contexto autenticado ou lança erro 401.
 * SUBSTITUA a implementação abaixo pela real do seu sistema.
 */
export async function getAuthContext(): Promise<AuthContext> {
  // ========== ÚNICO PONTO A PLUGAR ==========
  // O Contábil Pro já tem login/sessão funcionando (usado pelas outras rotas
  // do sistema, ex. /api/minhas-empresas, /api/usuarios). Troque as 3 linhas
  // abaixo pela mesma função de sessão que essas rotas já usam — geralmente
  // algo como `const sessao = await getSessaoAtual()` ou `getUsuarioLogado()`.
  //
  // Exemplo (ajuste o nome real da função/import do seu projeto):
  //   const sessao = await getSessaoAtual();
  //   if (!sessao) throw new AuthError("Não autenticado");
  //   return { empresaId: sessao.empresaId, usuarioId: sessao.usuarioId, email: sessao.email };

  // FALLBACK TEMPORÁRIO — só ativo em desenvolvimento, falha fechado (401) em
  // produção até a linha acima ser trocada pela sessão real. NÃO REMOVER o
  // guard de NODE_ENV — é o que impede qualquer requisição sem sessão de
  // passar como se fosse a empresa 24 quando o app for publicado.
  if (process.env.NODE_ENV === "development") {
    return { empresaId: 24, usuarioId: 1, email: "dev@local" };
  }

  throw new AuthError("Não autenticado");
}

export class AuthError extends Error {
  status = 401;
  constructor(message = "Não autenticado") {
    super(message);
    this.name = "AuthError";
  }
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
