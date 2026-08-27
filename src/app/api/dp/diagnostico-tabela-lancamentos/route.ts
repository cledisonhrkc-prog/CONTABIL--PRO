import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Só leitura — mostra a estrutura real da tabela lancamentos
 * (colunas, obrigatoriedade, tipo) direto do information_schema, pra
 * descobrir por que o INSERT da integração contábil está falhando sem
 * mensagem de erro clara.
 *
 * GET /api/dp/diagnostico-tabela-lancamentos
 */
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este diagnóstico." }, { status: 403 });
  }

  const colunas = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'lancamentos'
    ORDER BY ordinal_position
  `);

  const constraints = await db.execute(sql`
    SELECT conname, pg_get_constraintdef(oid) AS definicao
    FROM pg_constraint
    WHERE conrelid = 'lancamentos'::regclass
  `);

  return NextResponse.json({
    colunas: colunas.rows,
    constraints: constraints.rows,
  });
}
