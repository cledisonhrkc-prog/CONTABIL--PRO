import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/arquivo -> lista clientes e meses disponiveis
// GET /api/arquivo?cnpj=XX&mes=YYYY-MM -> resumo daquele cliente naquele mes
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cnpj = url.searchParams.get("cnpj");
  const mes = url.searchParams.get("mes");

  if (!cnpj) {
    const r = await db.execute<{ cnpj: string; nome: string; mes: string; qtd: string; total: string }>(sql`
      SELECT e.cnpj, e.nome,
             to_char(n.data_emissao, 'YYYY-MM') AS mes,
             COUNT(*)::text AS qtd,
             COALESCE(SUM(n.valor_total),0)::text AS total
      FROM notas_fiscais n JOIN empresas e ON n.empresa_id = e.id
      WHERE n.tipo_operacao = 'SAIDA' AND n.data_emissao IS NOT NULL
      GROUP BY e.cnpj, e.nome, to_char(n.data_emissao, 'YYYY-MM')
      ORDER BY e.nome, mes DESC
    `);
    return NextResponse.json({ ok: true, arquivo: r.rows });
  }

  const r = await db.execute<{ numero: string; data: string; participante: string; valor: string }>(sql`
    SELECT n.numero, n.data_emissao::text AS data, n.participante, n.valor_total::text AS valor
    FROM notas_fiscais n JOIN empresas e ON n.empresa_id = e.id
    WHERE e.cnpj = ${cnpj}
      AND (${mes}::text IS NULL OR to_char(n.data_emissao, 'YYYY-MM') = ${mes})
    ORDER BY n.data_emissao
  `);
  const total = r.rows.reduce((a, x) => a + Number(x.valor || 0), 0);
  return NextResponse.json({ ok: true, cnpj, mes, qtd: r.rows.length, total, notas: r.rows });
}
