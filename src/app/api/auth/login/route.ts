import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { verificarSenha, criarTokenSessao, ensureUsuariosTable } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await ensureUsuariosTable();
  const { email, senha } = await req.json();

  if (!email || !senha) {
    return NextResponse.json(
      { ok: false, mensagem: "Email e senha são obrigatórios." },
      { status: 400 }
    );
  }

  const emailNormalizado = String(email).toLowerCase().trim();

  const r = await db.execute<{ id: number; senha_hash: string; ativo: boolean }>(sql`
    SELECT id, senha_hash, ativo FROM usuarios WHERE email = ${emailNormalizado}
  `);

  const usuario = r.rows[0];
  if (!usuario || !usuario.ativo || !verificarSenha(senha, usuario.senha_hash)) {
    return NextResponse.json(
      { ok: false, mensagem: "Email ou senha inválidos." },
      { status: 401 }
    );
  }

  const token = criarTokenSessao(emailNormalizado);
  const res = NextResponse.json({ ok: true, mensagem: "Login realizado." });
  res.cookies.set("sessao", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
