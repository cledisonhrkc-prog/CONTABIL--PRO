import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

const STATEMENTS = [
  `ALTER TABLE colaborador_vinculos ADD COLUMN IF NOT EXISTS valor_emprestimo_consignado NUMERIC(15,2) DEFAULT 0`,
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
