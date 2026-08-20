import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * CORREÇÃO CRÍTICA — as tabelas de INSS/IRRF "2026" aplicadas hoje mais
 * cedo (via /api/dp/setup-calculo) estavam com valores incorretos, não
 * confirmados contra fonte oficial. Este setup:
 *
 * 1. Corrige a tabela de INSS CLT com os valores REAIS de 2026 (Portaria
 *    MPS/MF nº 13/2026, confirmado em gov.br/inss): faixas 1621,00 /
 *    2902,84 / 4354,27 / 8475,55 (teto), testado batendo com os exemplos
 *    oficiais (R$988,09 no teto, R$248,60 sobre R$3.000).
 * 2. Corrige a tabela de IRRF com os valores reais (tabela tradicional,
 *    sem mudança desde maio/2025): 2428,80 / 2826,65 / 3751,05 / 4664,68,
 *    parcelas a deduzir 182,16 / 394,16 / 675,49 / 908,73.
 * 3. Cria dp_calcular_inss_prolabore — 11% FIXO até o teto, específica
 *    pra sócio (contribuinte individual), separada da progressiva de CLT.
 *    Confirmado por múltiplas fontes: sócio NÃO usa a tabela progressiva.
 *
 * NÃO implementa ainda o redutor da Lei 15.270/2025 (zera IRRF até
 * R$5.000, reduz parcial até R$7.350) — é funcionalidade nova, não um
 * bug, fica para depois.
 *
 * Idempotente. Só admin.
 *   GET /api/dp/setup-calculo-v2
 */

const STATEMENTS = [
  // Marca as faixas antigas (incorretas) como expiradas, sem apagar
  // histórico — qualquer holerite já gravado continua consultável.
  `UPDATE dp_faixa_inss SET vigencia_fim = '2026-08-19' WHERE vigencia_inicio = '2026-01-01' AND vigencia_fim IS NULL`,
  `UPDATE dp_faixa_irrf SET vigencia_fim = '2026-08-19' WHERE vigencia_inicio = '2026-01-01' AND vigencia_fim IS NULL`,
  `UPDATE dp_parametro_irrf SET vigencia_fim = '2026-08-19' WHERE vigencia_inicio = '2026-01-01' AND vigencia_fim IS NULL`,

  // Faixas de INSS CORRETAS, vigentes a partir de hoje
  `INSERT INTO dp_faixa_inss (vigencia_inicio, vigencia_fim, faixa, valor_de, valor_ate, aliquota, parcela_deduzir) VALUES
    ('2026-08-20', NULL, 1, 0.00, 1621.00, 0.075, 0.00),
    ('2026-08-20', NULL, 2, 1621.01, 2902.84, 0.09, 24.32),
    ('2026-08-20', NULL, 3, 2902.85, 4354.27, 0.12, 111.40),
    ('2026-08-20', NULL, 4, 4354.28, 8475.55, 0.14, 198.49)
  ON CONFLICT (vigencia_inicio, faixa) DO NOTHING`,

  // Faixas de IRRF CORRETAS
  `INSERT INTO dp_faixa_irrf (vigencia_inicio, vigencia_fim, faixa, valor_de, valor_ate, aliquota, parcela_deduzir) VALUES
    ('2026-08-20', NULL, 1, 0.00, 2428.80, 0.00, 0.00),
    ('2026-08-20', NULL, 2, 2428.81, 2826.65, 0.075, 182.16),
    ('2026-08-20', NULL, 3, 2826.66, 3751.05, 0.15, 394.16),
    ('2026-08-20', NULL, 4, 3751.06, 4664.68, 0.225, 675.49),
    ('2026-08-20', NULL, 5, 4664.69, 99999999.99, 0.275, 908.73)
  ON CONFLICT (vigencia_inicio, faixa) DO NOTHING`,

  `INSERT INTO dp_parametro_irrf (vigencia_inicio, vigencia_fim, deducao_por_dependente, desconto_simplificado) VALUES
    ('2026-08-20', NULL, 189.59, 607.20)
  ON CONFLICT (vigencia_inicio) DO NOTHING`,

  // Motor específico de pró-labore: 11% FIXO até o teto (contribuinte
  // individual) — NÃO usa a tabela progressiva de CLT.
  `CREATE OR REPLACE FUNCTION dp_calcular_inss_prolabore(p_base NUMERIC, p_data DATE DEFAULT CURRENT_DATE)
  RETURNS NUMERIC LANGUAGE plpgsql AS $BODY$
  DECLARE
      v_teto NUMERIC;
      v_base_limitada NUMERIC;
  BEGIN
      IF p_base <= 0 THEN RETURN 0; END IF;

      SELECT valor_ate INTO v_teto
      FROM dp_faixa_inss
      WHERE p_data >= vigencia_inicio AND (vigencia_fim IS NULL OR p_data <= vigencia_fim)
      ORDER BY faixa DESC LIMIT 1;

      IF v_teto IS NULL THEN v_teto := 8475.55; END IF;

      v_base_limitada := LEAST(p_base, v_teto);
      RETURN ROUND(v_base_limitada * 0.11, 2);
  END;
  $BODY$`,
];

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este setup." }, { status: 403 });
  }

  const executados: string[] = [];
  const erros: { statement: string; erro: string }[] = [];

  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
      executados.push(stmt.trim().split("\n")[0].slice(0, 80));
    } catch (e: any) {
      erros.push({ statement: stmt.trim().split("\n")[0].slice(0, 80), erro: e.message });
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    total: STATEMENTS.length,
    executados: executados.length,
    erros,
  });
}
