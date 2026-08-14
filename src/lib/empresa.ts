import { db } from "@/db";
import { empresas } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { verificarTokenSessao } from "@/lib/auth";

export async function ensureUsuarioEmpresasTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS usuario_empresas (
      usuario_id INTEGER NOT NULL,
      empresa_id INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, empresa_id)
    )
  `);
}

export type UsuarioAtual = { id: number; email: string; admin: boolean };

/**
 * Lê a sessão (cookie) e retorna o usuário logado com seu status de admin.
 * Retorna null se não houver sessão válida.
 */
export async function usuarioAtual(): Promise<UsuarioAtual | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) return null;

  const r = await db.execute<{ id: number; admin: boolean }>(sql`
    SELECT id, admin FROM usuarios WHERE email = ${sessao.email}
  `);
  const u = r.rows[0];
  if (!u) return null;
  return { id: u.id, email: sessao.email, admin: !!u.admin };
}

/**
 * Retorna os IDs de empresa que o usuário pode acessar.
 * - Admin: retorna null, que significa "todas" (verificação dinâmica,
 *   não depende de vínculo manual — funciona mesmo para empresas
 *   cadastradas depois que o admin foi promovido).
 * - Não-admin: retorna o array de IDs vinculados em usuario_empresas.
 *   Pode ser um array VAZIO, o que significa "nenhuma empresa liberada
 *   ainda" — é preciso um admin (ou o próprio ato de importar um
 *   cliente novo, ver vincularUsuarioEmpresa) para liberar acesso.
 */
export async function empresasPermitidasIds(usuario: UsuarioAtual): Promise<number[] | null> {
  if (usuario.admin) return null;

  await ensureUsuarioEmpresasTable();
  const r = await db.execute<{ empresa_id: number }>(sql`
    SELECT empresa_id FROM usuario_empresas WHERE usuario_id = ${usuario.id}
  `);
  return r.rows.map((row) => row.empresa_id);
}

/**
 * Retorna a empresa "ativa" para o usuário logado:
 * 1. Sem sessão de login: null.
 * 2. Admin: pode escolher qualquer empresa cadastrada no sistema.
 * 3. Não-admin: só pode escolher entre as empresas vinculadas a ele.
 *    Se não tiver NENHUMA vinculada, não vê nenhuma empresa (null) —
 *    precisa de um admin vincular antes de conseguir usar o sistema.
 */
export async function getEmpresaAtiva() {
  try {
    const usuario = await usuarioAtual();
    if (!usuario) return null;

    const permitidos = await empresasPermitidasIds(usuario);

    const cookieStore = await cookies();
    const escolhidaStr = cookieStore.get("empresa_ativa_id")?.value;
    const escolhidaId = escolhidaStr ? Number(escolhidaStr) : null;

    // Admin: pode escolher qualquer empresa existente.
    if (permitidos === null) {
      if (escolhidaId) {
        const rows = await db.select().from(empresas).where(eq(empresas.id, escolhidaId)).limit(1);
        if (rows[0]) return rows[0];
      }
      const rows = await db.select().from(empresas).limit(1);
      return rows[0] ?? null;
    }

    // Não-admin sem nenhuma empresa vinculada: sem acesso.
    if (permitidos.length === 0) return null;

    const idFinal =
      escolhidaId && permitidos.includes(escolhidaId) ? escolhidaId : permitidos[0];

    const rows = await db.select().from(empresas).where(eq(empresas.id, idFinal)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca uma empresa pelo CNPJ SEM checar permissão do usuário.
 * Uso restrito: serve só para descobrir se um CNPJ já está cadastrado
 * no sistema (por exemplo, na hora de importar XML), antes de decidir
 * se cria uma empresa nova ou bloqueia por falta de permissão. NUNCA
 * usar o resultado desta função para exibir dados sem antes confirmar
 * que o usuário tem permissão nela.
 */
export async function buscarEmpresaPorCnpjSemFiltro(cnpjLimpo: string) {
  const rows = await db.select().from(empresas).where(eq(empresas.cnpj, cnpjLimpo)).limit(1);
  return rows[0] ?? null;
}

/**
 * Vincula um usuário a uma empresa (idempotente — não duplica se já
 * existir o vínculo). Usado, por exemplo, quando um usuário comum
 * (não-admin) importa os XMLs de um cliente novo: ele automaticamente
 * ganha acesso ao cliente que acabou de trazer para o sistema.
 */
export async function vincularUsuarioEmpresa(usuarioId: number, empresaId: number) {
  await ensureUsuarioEmpresasTable();
  await db.execute(sql`
    INSERT INTO usuario_empresas (usuario_id, empresa_id)
    VALUES (${usuarioId}, ${empresaId})
    ON CONFLICT DO NOTHING
  `);
}

export async function garantirEmpresa(dados: {
  cnpj: string;
  nome: string;
  regime?: string;
  anexo_simples?: string;
  segmento?: string;
}) {
  const existente = await db
    .select()
    .from(empresas)
    .where(eq(empresas.cnpj, dados.cnpj.replace(/\D/g, "")))
    .limit(1);
  if (existente[0]) return existente[0];
  const [novo] = await db
    .insert(empresas)
    .values({
      cnpj: dados.cnpj.replace(/\D/g, ""),
      nome: dados.nome,
      regime: dados.regime ?? "SIMPLES",
      anexo_simples: dados.anexo_simples ?? "I",
      segmento: dados.segmento ?? "COMERCIO",
    })
    .returning();
  return novo;
}
