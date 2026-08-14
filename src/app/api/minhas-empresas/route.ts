import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  const permitidos = await empresasPermitidasIds(usuario);

  let lista: { id: number; nome: string; cnpj: string }[];

  if (permitidos === null) {
    // Admin: vê todas.
    const r = await db.execute<{ id: number; nome: string; cnpj: string }>(sql`
      SELECT id, nome, cnpj FROM empresas ORDER BY nome
    `);
    lista = r.rows;
  } else if (permitidos.length === 0) {
    lista = [];
  } else {
    const r = await db.execute<{ id: number; nome: string; cnpj: string }>(sql`
      SELECT id, nome, cnpj FROM empresas WHERE id = ANY(${permitidos}) ORDER BY nome
    `);
    lista = r.rows;
  }

  return NextResponse.json({ ok: true, empresas: lista });
}
