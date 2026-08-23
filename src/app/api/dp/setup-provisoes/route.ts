import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dp_provisoes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    vinculo_id INTEGER NOT NULL REFERENCES colaborador_vinculos(id) ON DELETE CASCADE,
    competencia VARCHAR(7) NOT NULL,
    valor_provisao_ferias NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_provisao_decimo_terceiro NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provisao_vinculo_competencia UNIQUE (vinculo_id, competencia)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dp_provisoes_empresa ON dp_provisoes(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dp_provisoes_competencia ON dp_provisoes(competencia)`,
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
      executados.push(stmt.trim().slice(0, 90));
    } catch (e: any) {
      erros.push({ statement: stmt.trim().slice(0, 90), erro: e.message });
    }
  }
  return NextResponse.json({ ok: erros.length === 0, total: STATEMENTS.length, executados: executados.length, erros });
}
