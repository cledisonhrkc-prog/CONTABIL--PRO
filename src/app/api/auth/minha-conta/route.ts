import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { verificarTokenSessao, verificarSenha, hashSenha } from "@/lib/auth";

// Troca a senha (e opcionalmente o email) do usuário ATUALMENTE LOGADO.
// Exige a senha atual como confirmação. Não se auto-bloqueia — pode ser
// usada quantas vezes o usuário quiser, sempre exigindo a senha vigente
// no momento (nunca a senha original).
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);

  if (!sessao) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  const { senha_atual, novo_email, nova_senha } = await req.json();

  if (!senha_atual || !nova_senha) {
    return NextResponse.json(
      { ok: false, mensagem: "senha_atual e nova_senha são obrigatórias." },
      { status: 400 }
    );
  }
  if (String(nova_senha).length < 8) {
    return NextResponse.json(
      { ok: false, mensagem: "A nova senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const r = await db.execute<{ id: number; senha_hash: string }>(sql`
    SELECT id, senha_hash FROM usuarios WHERE email = ${sessao.email}
  `);
  const usuario = r.rows[0];

  if (!usuario || !verificarSenha(senha_atual, usuario.senha_hash)) {
    return NextResponse.json(
      { ok: false, mensagem: "Senha atual incorreta." },
      { status: 401 }
    );
  }

  const novoHash = hashSenha(nova_senha);
  const emailFinal = novo_email ? String(novo_email).toLowerCase().trim() : sessao.email;

  await db.execute(sql`
    UPDATE usuarios
    SET email = ${emailFinal}, senha_hash = ${novoHash}
    WHERE id = ${usuario.id}
  `);

  const res = NextResponse.json({
    ok: true,
    mensagem: "Senha atualizada. Use as novas credenciais no próximo login.",
    email: emailFinal,
  });

  // Encerra a sessão atual — força login de novo com as credenciais novas,
  // evitando ficar com uma sessão "presa" numa senha antiga.
  res.cookies.set("sessao", "", { path: "/", maxAge: 0 });

  return res;
}
