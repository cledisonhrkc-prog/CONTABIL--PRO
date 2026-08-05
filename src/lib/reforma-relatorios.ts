import { db } from "@/db";
import { sql } from "drizzle-orm";
import { modoReformaParaData } from "./reforma";

const round = (n: number) => Math.round(n * 100) / 100;

export async function apuracaoReformaPorAno(empresaId: number) {
  const r = await db.execute<{
    ano: string;
    cbs: string;
    ibs: string;
    is: string;
    pis: string;
    cofins: string;
    ipi: string;
    icms: string;
    iss: string;
    receita: string;
  }>(sql`
    WITH lc AS (
      SELECT
        extract(year FROM l.competencia)::text AS ano,
        li.codigo_conta,
        SUM(li.credito - li.debito) AS v
      FROM lancamento_itens li
      JOIN lancamentos l ON li.id_lanc = l.id
      WHERE l.empresa_id = ${empresaId} AND l.tipo_lanc='NORMAL'
      GROUP BY 1,2
    ),
    nf AS (
      SELECT extract(year FROM data_emissao)::text AS ano, SUM(valor_total) rec
      FROM notas_fiscais WHERE empresa_id=${empresaId} AND tipo_operacao='SAIDA'
      GROUP BY 1
    )
    SELECT
      COALESCE(lc.ano, nf.ano) AS ano,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.10' THEN v END),0)::text AS cbs,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.11' THEN v END),0)::text AS ibs,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.12' THEN v END),0)::text AS is,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.03' THEN v END),0)::text AS pis,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.04' THEN v END),0)::text AS cofins,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.02' THEN v END),0)::text AS ipi,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.01' THEN v END),0)::text AS icms,
      COALESCE(SUM(CASE WHEN codigo_conta='2.1.03.05' THEN v END),0)::text AS iss,
      COALESCE(MAX(nf.rec),0)::text AS receita
    FROM lc FULL OUTER JOIN nf ON lc.ano = nf.ano
    GROUP BY 1
    ORDER BY 1
  `);
  return r.rows
    .filter((x) => x.ano)
    .map((x) => {
      const dt = `${x.ano}-06-01`;
      return {
        ano: Number(x.ano),
        modo: modoReformaParaData(dt),
        receita: round(Number(x.receita ?? 0)),
        cbs: round(Number(x.cbs ?? 0)),
        ibs: round(Number(x.ibs ?? 0)),
        is: round(Number(x.is ?? 0)),
        pis: round(Number(x.pis ?? 0)),
        cofins: round(Number(x.cofins ?? 0)),
        ipi: round(Number(x.ipi ?? 0)),
        icms: round(Number(x.icms ?? 0)),
        iss: round(Number(x.iss ?? 0)),
      };
    });
}

export async function comparativoAntesDepois(empresaId: number) {
  const anos = await apuracaoReformaPorAno(empresaId);
  const preRef = anos.filter((a) => a.modo === "PRE_REFORMA");
  const pos27 = anos.filter((a) => a.modo === "REFORMA_2027" || a.modo === "REFORMA_2029" || a.modo === "REFORMA_2033");
  const transic = anos.filter((a) => a.modo === "TRANSICAO_2026");

  const soma = (arr: typeof anos, key: keyof (typeof anos)[number]) =>
    arr.reduce((a, x) => a + Number(x[key] ?? 0), 0);

  return {
    pre_reforma: {
      periodos: preRef.length,
      receita: round(soma(preRef, "receita")),
      pis: round(soma(preRef, "pis")),
      cofins: round(soma(preRef, "cofins")),
      ipi: round(soma(preRef, "ipi")),
      total_extintos: round(soma(preRef, "pis") + soma(preRef, "cofins") + soma(preRef, "ipi")),
    },
    transicao_2026: {
      periodos: transic.length,
      receita: round(soma(transic, "receita")),
      cbs_teste: round(soma(transic, "cbs")),
      ibs_teste: round(soma(transic, "ibs")),
    },
    reforma_2027: {
      periodos: pos27.length,
      receita: round(soma(pos27, "receita")),
      cbs: round(soma(pos27, "cbs")),
      ibs: round(soma(pos27, "ibs")),
      is: round(soma(pos27, "is")),
      total_novos: round(soma(pos27, "cbs") + soma(pos27, "ibs") + soma(pos27, "is")),
    },
  };
}
