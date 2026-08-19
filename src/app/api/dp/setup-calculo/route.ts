import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Rota de setup do motor de cálculo de INSS/IRRF (extensão do Escopo A).
 * Adiciona tabelas de faixas progressivas (com suporte a vigência) e as
 * funções dp_calcular_inss/dp_calcular_irrf, testadas contra Postgres real:
 *   - INSS sobre R$3.000 em 2026 → R$246,30 (confere)
 *   - IRRF sobre base R$2.753,70, 0 dependentes, 2026 → R$25,03 (confere)
 * Idempotente — pode rodar mais de uma vez sem duplicar (ON CONFLICT DO NOTHING).
 *
 * Só admin pode chamar.
 *   GET https://contabil-pro-wheat.vercel.app/api/dp/setup-calculo
 */

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dp_faixa_inss (
    id SERIAL PRIMARY KEY,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    faixa INTEGER NOT NULL,
    valor_de NUMERIC(15,2) NOT NULL,
    valor_ate NUMERIC(15,2) NOT NULL,
    aliquota NUMERIC(6,4) NOT NULL,
    parcela_deduzir NUMERIC(15,2) DEFAULT 0,
    UNIQUE (vigencia_inicio, faixa)
  )`,

  `CREATE TABLE IF NOT EXISTS dp_faixa_irrf (
    id SERIAL PRIMARY KEY,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    faixa INTEGER NOT NULL,
    valor_de NUMERIC(15,2) NOT NULL,
    valor_ate NUMERIC(15,2) NOT NULL,
    aliquota NUMERIC(6,4) NOT NULL,
    parcela_deduzir NUMERIC(15,2) DEFAULT 0,
    UNIQUE (vigencia_inicio, faixa)
  )`,

  `CREATE TABLE IF NOT EXISTS dp_parametro_irrf (
    id SERIAL PRIMARY KEY,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    deducao_por_dependente NUMERIC(15,2) NOT NULL,
    desconto_simplificado NUMERIC(15,2) NOT NULL,
    UNIQUE (vigencia_inicio)
  )`,

  `INSERT INTO dp_faixa_inss (vigencia_inicio, vigencia_fim, faixa, valor_de, valor_ate, aliquota, parcela_deduzir) VALUES
    ('2025-01-01', '2025-12-31', 1, 0.00, 1518.00, 0.075, 0.00),
    ('2025-01-01', '2025-12-31', 2, 1518.01, 2793.88, 0.09, 22.77),
    ('2025-01-01', '2025-12-31', 3, 2793.89, 4190.83, 0.12, 106.59),
    ('2025-01-01', '2025-12-31', 4, 4190.84, 8157.41, 0.14, 190.40)
  ON CONFLICT (vigencia_inicio, faixa) DO NOTHING`,

  `INSERT INTO dp_faixa_inss (vigencia_inicio, vigencia_fim, faixa, valor_de, valor_ate, aliquota, parcela_deduzir) VALUES
    ('2026-01-01', NULL, 1, 0.00, 1620.00, 0.075, 0.00),
    ('2026-01-01', NULL, 2, 1620.01, 2980.00, 0.09, 24.30),
    ('2026-01-01', NULL, 3, 2980.01, 4475.00, 0.12, 113.70),
    ('2026-01-01', NULL, 4, 4475.01, 8700.00, 0.14, 203.20)
  ON CONFLICT (vigencia_inicio, faixa) DO NOTHING`,

  `INSERT INTO dp_faixa_irrf (vigencia_inicio, vigencia_fim, faixa, valor_de, valor_ate, aliquota, parcela_deduzir) VALUES
    ('2025-01-01', '2025-12-31', 1, 0.00, 2259.20, 0.00, 0.00),
    ('2025-01-01', '2025-12-31', 2, 2259.21, 2826.65, 0.075, 169.44),
    ('2025-01-01', '2025-12-31', 3, 2826.66, 3751.05, 0.15, 381.44),
    ('2025-01-01', '2025-12-31', 4, 3751.06, 4664.68, 0.225, 662.77),
    ('2025-01-01', '2025-12-31', 5, 4664.69, 99999999.99, 0.275, 896.00)
  ON CONFLICT (vigencia_inicio, faixa) DO NOTHING`,

  `INSERT INTO dp_faixa_irrf (vigencia_inicio, vigencia_fim, faixa, valor_de, valor_ate, aliquota, parcela_deduzir) VALUES
    ('2026-01-01', NULL, 1, 0.00, 2420.00, 0.00, 0.00),
    ('2026-01-01', NULL, 2, 2420.01, 3025.00, 0.075, 181.50),
    ('2026-01-01', NULL, 3, 3025.01, 4015.00, 0.15, 408.00),
    ('2026-01-01', NULL, 4, 4015.01, 4990.00, 0.225, 709.00),
    ('2026-01-01', NULL, 5, 4990.01, 99999999.99, 0.275, 960.00)
  ON CONFLICT (vigencia_inicio, faixa) DO NOTHING`,

  `INSERT INTO dp_parametro_irrf (vigencia_inicio, vigencia_fim, deducao_por_dependente, desconto_simplificado) VALUES
    ('2025-01-01', '2025-12-31', 189.59, 564.80),
    ('2026-01-01', NULL, 189.59, 564.80)
  ON CONFLICT (vigencia_inicio) DO NOTHING`,

  `CREATE OR REPLACE FUNCTION dp_calcular_inss(p_base NUMERIC, p_data DATE DEFAULT CURRENT_DATE)
  RETURNS NUMERIC LANGUAGE plpgsql AS $BODY$
  DECLARE
      v_faixa RECORD;
      v_inss NUMERIC := 0;
  BEGIN
      IF p_base <= 0 THEN RETURN 0; END IF;

      SELECT * INTO v_faixa
      FROM dp_faixa_inss
      WHERE p_data >= vigencia_inicio
        AND (vigencia_fim IS NULL OR p_data <= vigencia_fim)
        AND p_base BETWEEN valor_de AND valor_ate
      ORDER BY faixa LIMIT 1;

      IF NOT FOUND THEN
          SELECT * INTO v_faixa
          FROM dp_faixa_inss
          WHERE p_data >= vigencia_inicio AND (vigencia_fim IS NULL OR p_data <= vigencia_fim)
          ORDER BY faixa DESC LIMIT 1;
          IF FOUND THEN
              v_inss := (v_faixa.valor_ate * v_faixa.aliquota) - v_faixa.parcela_deduzir;
          END IF;
      ELSE
          v_inss := (p_base * v_faixa.aliquota) - v_faixa.parcela_deduzir;
      END IF;

      RETURN ROUND(GREATEST(v_inss, 0), 2);
  END;
  $BODY$`,

  `CREATE OR REPLACE FUNCTION dp_calcular_irrf(
      p_base NUMERIC,
      p_qtd_dependentes INTEGER DEFAULT 0,
      p_data DATE DEFAULT CURRENT_DATE,
      p_usar_desconto_simplificado BOOLEAN DEFAULT false
  )
  RETURNS NUMERIC LANGUAGE plpgsql AS $BODY$
  DECLARE
      v_param RECORD;
      v_faixa RECORD;
      v_base NUMERIC;
      v_irrf NUMERIC := 0;
  BEGIN
      IF p_base <= 0 THEN RETURN 0; END IF;

      SELECT * INTO v_param
      FROM dp_parametro_irrf
      WHERE p_data >= vigencia_inicio AND (vigencia_fim IS NULL OR p_data <= vigencia_fim)
      ORDER BY vigencia_inicio DESC LIMIT 1;
      IF NOT FOUND THEN RETURN 0; END IF;

      IF p_usar_desconto_simplificado THEN
          v_base := p_base - v_param.desconto_simplificado;
      ELSE
          v_base := p_base - (COALESCE(p_qtd_dependentes,0) * v_param.deducao_por_dependente);
      END IF;
      v_base := GREATEST(v_base, 0);

      SELECT * INTO v_faixa
      FROM dp_faixa_irrf
      WHERE p_data >= vigencia_inicio AND (vigencia_fim IS NULL OR p_data <= vigencia_fim)
        AND v_base BETWEEN valor_de AND valor_ate
      ORDER BY faixa LIMIT 1;

      IF FOUND THEN
          v_irrf := (v_base * v_faixa.aliquota) - v_faixa.parcela_deduzir;
      END IF;

      RETURN ROUND(GREATEST(v_irrf, 0), 2);
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
