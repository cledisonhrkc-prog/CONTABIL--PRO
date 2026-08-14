import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { hashSenha, ensureUsuariosTable } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await ensureUsuariosTable();

  const existentes = await db.execute<{ total: string }>(
    sql`SELECT COUNT(*)::text AS total FROM usuarios`
  );
  const total = Number(existentes.rows[0]?.total ?? 0);

  if (total > 0) {
    return NextResponse.json(
      {
        ok: false,
        mensagem: "Já existe usuário cadastrado. Esta rota só funciona para o primeiro cadastro.",
      },
      { status: 403 }
    );
  }

  const { email, senha, nome } = await req.json();

  if (!email || !senha) {
    return NextResponse.json(
      { ok: false, mensagem: "Email e senha são obrigatórios." },
      { status: 400 }
    );
  }
  if (String(senha).length < 8) {
    return NextResponse.json(
      { ok: false, mensagem: "A senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const emailNormalizado = String(email).toLowerCase().trim();
  const hash = hashSenha(senha);

  await db.execute(sql`
    INSERT INTO usuarios (email, senha_hash, nome, ativo)
    VALUES (${emailNormalizado}, ${hash}, ${nome ?? null}, true)
  `);

  return NextResponse.json({ ok: true, mensagem: "Usuário criado com sucesso. Já pode fazer login." });
}
