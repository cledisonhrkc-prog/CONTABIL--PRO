import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * CORREÇÃO — validada contra holerite real (Faurecia, julho/2026):
 * INSS calculado R$506,94 vs. R$506,93 real, bate.
 *
 * Bug encontrado: a correção anterior (setup-calculo-v2) só valia a
 * partir de 20/08/2026 (a data em que rodei a correção), deixando
 * qualquer competência de jan-ago/2026 usando a tabela ERRADA. As
 * faixas de 2026 são do ano inteiro, não "a partir de quando eu
 * consegui corrigir" — esse setup remove as faixas erradas de
 * jan-ago/2026 e estende a vigência das corretas pro ano inteiro.
 *
 * Idempotente. Só admin.
 *   GET /api/dp/setup-vigencia-fix
 */

const STATEMENTS = [
  `DELETE FROM dp_faixa_inss WHERE vigencia_inicio = '2026-01-01' AND vigencia_fim = '2026-08-19'`,
  `DELETE FROM dp_faixa_irrf WHERE vigencia_inicio = '2026-01-01' AND vigencia_fim = '2026-08-19'`,
  `DELETE FROM dp_parametro_irrf WHERE vigencia_inicio = '2026-01-01' AND vigencia_fim = '2026-08-19'`,
  `UPDATE dp_faixa_inss SET vigencia_inicio = '2026-01-01' WHERE vigencia_inicio = '2026-08-20'`,
  `UPDATE dp_faixa_irrf SET vigencia_inicio = '2026-01-01' WHERE vigencia_inicio = '2026-08-20'`,
  `UPDATE dp_parametro_irrf SET vigencia_inicio = '2026-01-01' WHERE vigencia_inicio = '2026-08-20'`,
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
