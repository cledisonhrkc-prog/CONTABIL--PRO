import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Só leitura — investiga por que o Roberto processou com líquido
 * errado (R$1.100 em vez de ~R$2.751,40 esperado). Mostra TODOS os
 * vínculos dele, pra achar se existe duplicata ou data de admissão
 * errada.
 *
 * GET /api/dp/diagnostico-roberto
 */
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este diagnóstico." }, { status: 403 });
  }

  const colaboradores = await db.execute(sql`
    SELECT id, empresa_id, nome_completo, cpf FROM colaboradores
    WHERE nome_completo ILIKE '%roberto%'
  `);

  const vinculos = await db.execute(sql`
    SELECT cv.id, cv.colaborador_id, cv.empresa_id, cv.tipo_vinculo, cv.salario_base,
           cv.data_admissao, cv.is_ativo, cv.deleted_at, c.nome_completo
    FROM colaborador_vinculos cv
    JOIN colaboradores c ON c.id = cv.colaborador_id
    WHERE c.nome_completo ILIKE '%roberto%'
  `);

  const holerites = await db.execute(sql`
    SELECT h.id, h.colaborador_id, h.competencia, h.salario_base, h.total_proventos,
           h.total_liquido, h.created_at
    FROM dp_holerites h
    JOIN colaboradores c ON c.id = h.colaborador_id
    WHERE c.nome_completo ILIKE '%roberto%'
    ORDER BY h.created_at DESC
    LIMIT 10
  `);

  return NextResponse.json({
    colaboradores: colaboradores.rows,
    vinculos: vinculos.rows,
    ultimos_holerites: holerites.rows,
  });
}
