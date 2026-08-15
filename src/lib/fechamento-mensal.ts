import { db } from "@/db";
import { sql } from "drizzle-orm";

const round = (v: number) => Math.round(v * 100) / 100;

export type FechamentoMensal = {
  empresa: { id: number; nome: string; cnpj: string; regime: string };
  mes: string; // "2026-07"
  notas: Array<{
    numero: string;
    data_emissao: string;
    tipo_operacao: string;
    finalidade: string;
    participante: string;
    valor_total: number;
  }>;
  resumo: {
    qtd_notas: number;
    receitas: number;
    despesas: number;
    saldo: number;
  };
  impostos_do_mes: Array<{ historico: string; valor: number }>;
  aviso_regime_anual: string | null;
};

/**
 * Gera o fechamento de UM mês específico para qualquer empresa (não
 * depende da "empresa ativa" da sessão — recebe o ID direto). Função
 * NOVA e separada, não reaproveita nem altera balanco()/apuracao()/dre()
 * do parecer completo existente.
 */
export async function gerarFechamentoMensal(
  empresaId: number,
  mes: string // formato "AAAA-MM"
): Promise<FechamentoMensal | null> {
  const empQ = await db.execute<{ id: number; nome: string; cnpj: string; regime: string }>(sql`
    SELECT id, nome, cnpj, regime FROM empresas WHERE id = ${empresaId}
  `);
  const emp = empQ.rows[0];
  if (!emp) return null;

  const notasQ = await db.execute<{
    numero: string;
    data_emissao: string;
    tipo_operacao: string;
    finalidade: string;
    participante: string;
    valor_total: string;
  }>(sql`
    SELECT numero, data_emissao::text, tipo_operacao, finalidade, participante, valor_total::text
    FROM notas_fiscais
    WHERE empresa_id = ${empresaId}
      AND to_char(data_emissao, 'YYYY-MM') = ${mes}
    ORDER BY data_emissao
  `);

  const notas = notasQ.rows.map((r) => ({
    numero: r.numero,
    data_emissao: r.data_emissao,
    tipo_operacao: r.tipo_operacao,
    finalidade: r.finalidade,
    participante: r.participante,
    valor_total: round(Number(r.valor_total)),
  }));

  const receitas = notas
    .filter((n) => n.tipo_operacao === "SAIDA")
    .reduce((a, n) => a + n.valor_total, 0);
  const despesas = notas
    .filter((n) => n.tipo_operacao === "ENTRADA")
    .reduce((a, n) => a + n.valor_total, 0);

  const impostosQ = await db.execute<{ historico: string; valor_total: string }>(sql`
    SELECT historico, valor_total::text
    FROM lancamentos
    WHERE empresa_id = ${empresaId}
      AND tipo_lanc = 'NORMAL'
      AND origem IN ('DAS', 'FISCAL')
      AND to_char(data, 'YYYY-MM') = ${mes}
      AND (historico LIKE '%DAS%' OR historico LIKE 'Impostos s/%')
    ORDER BY data
  `);

  const impostos_do_mes = impostosQ.rows.map((r) => ({
    historico: r.historico,
    valor: round(Number(r.valor_total)),
  }));

  const aviso_regime_anual =
    emp.regime === "LUCRO_PRESUMIDO" || emp.regime === "LUCRO_REAL"
      ? "IRPJ e CSLL neste regime são apurados ANUALMENTE (lançados em 31/12), não mês a mês. Este fechamento mensal mostra apenas os impostos incidentes sobre as notas do mês (CBS, IBS, ICMS, PIS, COFINS, ISS, IPI quando aplicável) — o valor de IRPJ/CSLL do ano completo consta apenas no parecer anual completo."
      : null;

  return {
    empresa: { id: emp.id, nome: emp.nome, cnpj: emp.cnpj, regime: emp.regime },
    mes,
    notas,
    resumo: {
      qtd_notas: notas.length,
      receitas: round(receitas),
      despesas: round(despesas),
      saldo: round(receitas - despesas),
    },
    impostos_do_mes,
    aviso_regime_anual,
  };
}
