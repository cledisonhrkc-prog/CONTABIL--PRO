import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Só leitura — busca contas do plano de contas real que possam servir
 * pra integração DP→Contábil (despesa de pessoal, obrigações fiscais,
 * salários a pagar). Não inventa código, mostra o que existe de verdade.
 *
 * GET /api/dp/buscar-plano-contas
 */
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar esta busca." }, { status: 403 });
  }

  const candidatos = await db.execute(sql`
    SELECT codigo, descricao, tipo, natureza, nivel
    FROM plano_contas
    WHERE descricao ILIKE '%pessoal%'
       OR descricao ILIKE '%sal%rio%'
       OR descricao ILIKE '%inss%'
       OR descricao ILIKE '%fgts%'
       OR descricao ILIKE '%irrf%'
       OR descricao ILIKE '%folha%'
       OR descricao ILIKE '%obriga%'
       OR descricao ILIKE '%fiscal%'
       OR descricao ILIKE '%encargo%'
    ORDER BY codigo
    LIMIT 50
  `);

  const todasNivel4 = await db.execute(sql`
    SELECT codigo, descricao, tipo, natureza
    FROM plano_contas
    WHERE nivel = 4
    ORDER BY codigo
    LIMIT 100
  `);

  return NextResponse.json({
    candidatos_relacionados_a_folha: candidatos.rows,
    todas_contas_nivel_4: todasNivel4.rows,
  });
}
