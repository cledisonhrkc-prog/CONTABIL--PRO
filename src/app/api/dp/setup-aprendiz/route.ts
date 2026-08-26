import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Adiciona 'APRENDIZ' na lista de tipos de vínculo permitidos. A
 * constraint já tinha ESTAGIO/AUTONOMO/TEMPORARIO, só faltava esse.
 * Precisa achar o nome real da constraint (gerado automaticamente pelo
 * Postgres) antes de dropar, porque não é fixo.
 */
const STATEMENTS = [
  `DO $$
   DECLARE
     v_nome_constraint TEXT;
   BEGIN
     SELECT conname INTO v_nome_constraint
     FROM pg_constraint
     WHERE conrelid = 'colaborador_vinculos'::regclass
       AND pg_get_constraintdef(oid) LIKE '%tipo_vinculo%'
       AND contype = 'c';

     IF v_nome_constraint IS NOT NULL THEN
       EXECUTE format('ALTER TABLE colaborador_vinculos DROP CONSTRAINT %I', v_nome_constraint);
     END IF;

     ALTER TABLE colaborador_vinculos
       ADD CONSTRAINT colaborador_vinculos_tipo_vinculo_check
       CHECK (tipo_vinculo IN ('CLT', 'PRO_LABORE', 'ESTAGIO', 'AUTONOMO', 'TEMPORARIO', 'APRENDIZ'));
   END $$`,
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
