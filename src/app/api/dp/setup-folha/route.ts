import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Setup do schema de rubricas + holerites (folha CLT), aditivo ao Escopo A.
 * Testado ponta a ponta: salário R$3.000 → INSS R$246,30, IRRF R$25,03,
 * FGTS R$240,00, com rubrica de desconto aplicada — confere.
 * Idempotente. Só admin pode chamar.
 *   GET https://contabil-pro-wheat.vercel.app/api/dp/setup-folha
 */

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dp_rubricas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(20) NOT NULL,
    nome VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PROVENTO', 'DESCONTO')),
    valor_fixo NUMERIC(15,2) DEFAULT 0,
    is_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rubrica_empresa_codigo UNIQUE (empresa_id, codigo)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dp_rubricas_empresa ON dp_rubricas(empresa_id) WHERE is_ativo = TRUE`,

  `CREATE TABLE IF NOT EXISTS dp_holerites (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    vinculo_id INTEGER NOT NULL REFERENCES colaborador_vinculos(id) ON DELETE CASCADE,
    competencia CHAR(7) NOT NULL,
    salario_base NUMERIC(15,2) NOT NULL,
    total_proventos NUMERIC(15,2) NOT NULL,
    total_descontos NUMERIC(15,2) NOT NULL,
    total_liquido NUMERIC(15,2) NOT NULL,
    fgts_mes NUMERIC(15,2) NOT NULL,
    valor_inss NUMERIC(15,2) NOT NULL,
    valor_irrf NUMERIC(15,2) NOT NULL,
    itens_json JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSADO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_holerite_colaborador_competencia UNIQUE (colaborador_id, competencia)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dp_holerites_empresa ON dp_holerites(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dp_holerites_competencia ON dp_holerites(empresa_id, competencia)`,
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
