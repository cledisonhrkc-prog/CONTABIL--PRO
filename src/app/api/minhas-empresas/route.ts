import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { verificarTokenSessao } from "@/lib/auth";
import { ensureUsuarioEmpresasTable } from "@/lib/empresa";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  await ensureUsuarioEmpresasTable();

  const usuarioR = await db.execute<{ id: number }>(sql`
    SELECT id FROM usuarios WHERE email = ${sessao.email}
  `);
  const usuarioId = usuarioR.rows[0]?.id;
  if (!usuarioId) {
    return NextResponse.json({ ok: false, mensagem: "Usuário não encontrado." }, { status: 404 });
  }

  const vinculosR = await db.execute<{ empresa_id: number }>(sql`
    SELECT empresa_id FROM usuario_empresas WHERE usuario_id = ${usuarioId}
  `);

  let lista: { id: number; nome: string; cnpj: string }[];

  if (vinculosR.rows.length === 0) {
    // Sem vínculo configurado ainda: mostra todas (comportamento provisório).
    const r = await db.execute<{ id: number; nome: string; cnpj: string }>(sql`
      SELECT id, nome, cnpj FROM empresas ORDER BY nome
    `);
    lista = r.rows;
  } else {
    const ids = vinculosR.rows.map((row) => row.empresa_id);
    const r = await db.execute<{ id: number; nome: string; cnpj: string }>(sql`
      SELECT id, nome, cnpj FROM empresas WHERE id = ANY(${ids}) ORDER BY nome
    `);
    lista = r.rows;
  }

  return NextResponse.json({ ok: true, empresas: lista });
}
