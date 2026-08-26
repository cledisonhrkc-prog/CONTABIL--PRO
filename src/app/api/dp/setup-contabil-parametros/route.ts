import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS contabil_parametros_dp (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    conta_debito_despesa VARCHAR(20) NOT NULL,
    conta_credito_inss_passivo VARCHAR(20) NOT NULL,
    conta_credito_fgts_passivo VARCHAR(20) NOT NULL,
    conta_credito_irrf_passivo VARCHAR(20) NOT NULL,
    conta_credito_salarios_a_pagar VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contabil_parametros_empresa UNIQUE (empresa_id)
  )`,
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
