import { NextResponse } from "next/server";
import { db } from "@/db";
import { notasFiscais } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getEmpresaAtiva } from "@/lib/empresa";
import { compararRegimes, melhorRegime } from "@/lib/comparativo-regimes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  const url = new URL(req.url);
  const margem = url.searchParams.get("margem")
    ? Number(url.searchParams.get("margem")) / 100
    : null;

  // Descobre o período e faturamento observado
  const r = await db.execute<{
    fat: string;
    dmin: string | null;
    dmax: string | null;
  }>(sql`
    SELECT
      COALESCE(SUM(valor_total - valor_icms_st), 0)::text AS fat,
      MIN(data_emissao)::text AS dmin,
      MAX(data_emissao)::text AS dmax
    FROM notas_fiscais
    WHERE empresa_id = ${emp.id}
      AND tipo_operacao = 'SAIDA'
      AND finalidade IN ('VENDA','SERVICO')
  `);
  const row = r.rows[0];
  const fat = Number(row?.fat ?? 0);
  const dmin = row?.dmin ? new Date(row.dmin) : null;
  const dmax = row?.dmax ? new Date(row.dmax) : null;
  let meses = 1;
  if (dmin && dmax) {
    const diff =
      (dmax.getFullYear() - dmin.getFullYear()) * 12 + (dmax.getMonth() - dmin.getMonth()) + 1;
    meses = Math.max(1, diff);
  }

  const regimes = compararRegimes({
    faturamento_periodo: fat,
    meses_periodo: meses,
    segmento: emp.segmento ?? "COMERCIO",
    anexo_simples: emp.anexo_simples ?? "I",
    margem_operacional: margem ?? undefined,
    regime_atual: emp.regime,
  });

  return NextResponse.json({
    ok: true,
    empresa: {
      nome: emp.nome,
      cnpj: emp.cnpj,
      regime_atual: emp.regime,
      segmento: emp.segmento,
    },
    periodo: {
      inicio: row?.dmin,
      fim: row?.dmax,
      meses,
      faturamento_periodo: fat,
      faturamento_anualizado: (fat / meses) * 12,
    },
    regimes,
    melhor: melhorRegime(regimes),
    aviso_juridico:
      "Este comparativo é uma ESTIMATIVA baseada nas notas processadas. Não substitui análise contábil detalhada. Cálculos NÃO incluem ICMS/ISS (que variam por UF e produto). Alíquotas da Reforma Tributária são REFERÊNCIAS do Ministério da Fazenda e podem mudar por lei anual. Consulte contador antes de qualquer decisão de mudança de regime.",
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ref = { notasFiscais, and, eq };
}
