import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { verificarTokenSessao } from "@/lib/auth";
import { ensureUsuarioEmpresasTable } from "@/lib/empresa";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  await ensureUsuarioEmpresasTable();

  const { empresa_id } = await req.json();
  if (!empresa_id) {
    return NextResponse.json({ ok: false, mensagem: "empresa_id é obrigatório." }, { status: 400 });
  }

  const usuarioR = await db.execute<{ id: number }>(sql`
    SELECT id FROM usuarios WHERE email = ${sessao.email}
  `);
  const usuarioId = usuarioR.rows[0]?.id;

  const vinculosR = await db.execute<{ empresa_id: number }>(sql`
    SELECT empresa_id FROM usuario_empresas WHERE usuario_id = ${usuarioId}
  `);

  const semVinculos = vinculosR.rows.length === 0;
  const permitido =
    semVinculos || vinculosR.rows.some((row) => row.empresa_id === Number(empresa_id));

  if (!permitido) {
    return NextResponse.json(
      { ok: false, mensagem: "Você não tem permissão para acessar esta empresa." },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ ok: true, mensagem: "Empresa selecionada." });
  res.cookies.set("empresa_ativa_id", String(empresa_id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
