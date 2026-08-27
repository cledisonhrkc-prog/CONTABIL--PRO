import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Adiciona 'ACORDO' aos motivos de rescisão permitidos (Art. 484-A CLT,
 * Lei 13.467/2017). Mesmo padrão de hoje: acha o nome real da
 * constraint (gerado automaticamente) antes de trocar.
 */
const STATEMENTS = [
  `DO $$
   DECLARE
     v_nome_constraint TEXT;
   BEGIN
     SELECT conname INTO v_nome_constraint
     FROM pg_constraint
     WHERE conrelid = 'dp_rescisoes'::regclass
       AND pg_get_constraintdef(oid) LIKE '%motivo%'
       AND contype = 'c';

     IF v_nome_constraint IS NOT NULL THEN
       EXECUTE format('ALTER TABLE dp_rescisoes DROP CONSTRAINT %I', v_nome_constraint);
     END IF;

     ALTER TABLE dp_rescisoes
       ADD CONSTRAINT dp_rescisoes_motivo_check
       CHECK (motivo IN ('SEM_JUSTA_CAUSA', 'COM_JUSTA_CAUSA', 'PEDIDO_DEMISSAO', 'ACORDO'));
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
