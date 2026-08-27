import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Só leitura — investiga se a "repetição" da nota fiscal 6262175 na
 * Auditoria R08 é duplicação real (bug) ou comportamento esperado
 * (múltiplos itens/produtos na mesma nota, cada um violando a regra
 * separadamente). Não corrige nada, só diagnostica.
 *
 * GET /api/dp/diagnostico-auditoria-r08?empresaId=24
 */
export async function GET(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este diagnóstico." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const empresaId = Number(searchParams.get("empresaId"));
  if (!empresaId) {
    return NextResponse.json({ error: "Informe ?empresaId=N na URL." }, { status: 400 });
  }

  // 1. Quantas linhas de auditoria existem por número de NF (achar os
  // casos de repetição, não só o exemplo que já vimos)
  const repeticoes = await db.execute(sql`
    SELECT numero_nf, COUNT(*)::int AS qtd_linhas,
      array_agg(DISTINCT valor_nota) AS valores_distintos,
      array_agg(id ORDER BY id) AS ids
    FROM auditoria
    WHERE empresa_id = ${empresaId}
    GROUP BY numero_nf
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);

  // 2. Pega o caso mais repetido e olha se os itens_nf (produtos da
  // nota) batem em quantidade com as linhas de auditoria — se bater,
  // é 1 linha por produto (comportamento esperado). Se não bater, é
  // bug de verdade.
  const casoExemplo = repeticoes.rows[0] as any;
  let comparacaoItensNf: any = null;
  if (casoExemplo) {
    const itensDaNota = await db.execute(sql`
      SELECT COUNT(*)::int AS qtd_itens_na_nota
      FROM itens_nf i
      JOIN notas_fiscais n ON i.id_nf = n.id
      WHERE n.numero = ${casoExemplo.numero_nf} AND n.empresa_id = ${empresaId}
    `);
    comparacaoItensNf = {
      numero_nf: casoExemplo.numero_nf,
      qtd_linhas_auditoria: casoExemplo.qtd_linhas,
      qtd_itens_na_nota_fiscal: (itensDaNota.rows[0] as any)?.qtd_itens_na_nota ?? null,
    };
  }

  return NextResponse.json({
    total_notas_com_repeticao: repeticoes.rows.length,
    amostra_repeticoes: repeticoes.rows,
    comparacao_com_itens_da_nota: comparacaoItensNf,
    interpretacao:
      comparacaoItensNf?.qtd_linhas_auditoria === comparacaoItensNf?.qtd_itens_na_nota_fiscal
        ? "Quantidade de linhas de auditoria bate com quantidade de itens na nota — parece ser 1 linha por produto (comportamento esperado, não bug)."
        : "Quantidade NÃO bate — pode ser duplicação real. Investigar mais.",
  });
}
