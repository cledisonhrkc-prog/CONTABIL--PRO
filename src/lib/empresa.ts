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

async function usuarioLogadoId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) return null;

  const r = await db.execute<{ id: number }>(sql`
    SELECT id FROM usuarios WHERE email = ${sessao.email}
  `);
  return r.rows[0]?.id ?? null;
}

/**
 * Retorna a empresa "ativa" para o usuário logado:
 * 1. Se ele escolheu uma empresa (cookie empresa_ativa_id) e tem permissão nela, usa essa.
 * 2. Senão, usa a primeira empresa que ele tem permissão de ver.
 * 3. Se o usuário ainda não tem NENHUM vínculo cadastrado em usuario_empresas
 *    (comportamento provisório, até alguém vincular usuários a empresas),
 *    cai no comportamento antigo: primeira empresa cadastrada no sistema.
 *    Isso evita qualquer regressão para quem já estava usando o sistema
 *    antes de existir controle de acesso por empresa.
 */
export async function getEmpresaAtiva() {
  try {
    await ensureUsuarioEmpresasTable();

    const usuarioId = await usuarioLogadoId();

    let empresasPermitidas: number[] = [];
    if (usuarioId) {
      const r = await db.execute<{ empresa_id: number }>(sql`
        SELECT empresa_id FROM usuario_empresas WHERE usuario_id = ${usuarioId}
      `);
      empresasPermitidas = r.rows.map((row) => row.empresa_id);
    }

    // Nenhum vínculo configurado ainda para este usuário: comportamento
    // provisório de compatibilidade — mostra a primeira empresa do sistema.
    if (empresasPermitidas.length === 0) {
      const rows = await db.select().from(empresas).limit(1);
      return rows[0] ?? null;
    }

    const cookieStore = await cookies();
    const escolhidaStr = cookieStore.get("empresa_ativa_id")?.value;
    const escolhidaId = escolhidaStr ? Number(escolhidaStr) : null;

    const idFinal =
      escolhidaId && empresasPermitidas.includes(escolhidaId)
        ? escolhidaId
        : empresasPermitidas[0];

    const rows = await db.select().from(empresas).where(eq(empresas.id, idFinal)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
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
