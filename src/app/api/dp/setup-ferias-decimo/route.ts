import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dp_ferias (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    vinculo_id INTEGER NOT NULL REFERENCES colaborador_vinculos(id) ON DELETE CASCADE,
    periodo_aquisitivo_inicio DATE NOT NULL,
    periodo_aquisitivo_fim DATE NOT NULL,
    data_inicio_gozo DATE NOT NULL,
    data_fim_gozo DATE NOT NULL,
    dias_gozo INTEGER NOT NULL,
    abono_pecuniario BOOLEAN NOT NULL DEFAULT FALSE,
    dias_abono INTEGER NOT NULL DEFAULT 0,
    valor_ferias NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_terco NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_abono NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_terco_abono NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_inss NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_irrf NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_bruto NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_liquido NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'CALCULADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dp_ferias_empresa ON dp_ferias(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dp_ferias_vinculo ON dp_ferias(vinculo_id)`,
  `CREATE TABLE IF NOT EXISTS dp_decimo_terceiro (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    vinculo_id INTEGER NOT NULL REFERENCES colaborador_vinculos(id) ON DELETE CASCADE,
    ano INTEGER NOT NULL,
    parcela INTEGER NOT NULL CHECK (parcela IN (1, 2)),
    valor_bruto_total NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_parcela NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_inss NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_irrf NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_liquido NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'CALCULADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_decimo_vinculo_ano_parcela UNIQUE (vinculo_id, ano, parcela)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dp_decimo_empresa ON dp_decimo_terceiro(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dp_decimo_vinculo ON dp_decimo_terceiro(vinculo_id)`,
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
  return NextResponse.json({ ok: erros.length === 0, total: STATEMENTS.length, executados: executados.length, erros });
}
