import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Só leitura — mostra a extensão real do problema de encoding na tabela
 * auditoria antes de qualquer UPDATE. Não corrige nada, só diagnostica.
 *
 * GET /api/dp/diagnostico-encoding
 */
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este diagnóstico." }, { status: 403 });
  }

  const total = await db.execute(sql`
    SELECT COUNT(*)::int AS qtd FROM auditoria WHERE descricao LIKE '%Ã%'
  `);

  const distintas = await db.execute(sql`
    SELECT DISTINCT descricao FROM auditoria WHERE descricao LIKE '%Ã%' LIMIT 50
  `);

  const totalAcao = await db.execute(sql`
    SELECT COUNT(*)::int AS qtd FROM auditoria WHERE acao LIKE '%Ã%'
  `);

  return NextResponse.json({
    linhas_com_descricao_quebrada: (total.rows[0] as any).qtd,
    linhas_com_acao_quebrada: (totalAcao.rows[0] as any).qtd,
    textos_distintos_quebrados: distintas.rows.map((r: any) => r.descricao),
  });
}
