import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { hashSenha, ensureUsuariosTable } from "@/lib/auth";

// Rota simples para trocar email/senha do usuário existente.
// Exige o email atual (o que você usou para criar a conta) como
// confirmação, para não virar uma porta aberta para qualquer um.
export async function POST(req: NextRequest) {
  await ensureUsuariosTable();

  const { email_atual, novo_email, nova_senha } = await req.json();

  if (!email_atual || !novo_email || !nova_senha) {
    return NextResponse.json(
      { ok: false, mensagem: "email_atual, novo_email e nova_senha são obrigatórios." },
      { status: 400 }
    );
  }
  if (String(nova_senha).length < 8) {
    return NextResponse.json(
      { ok: false, mensagem: "A nova senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const emailAtualNormalizado = String(email_atual).toLowerCase().trim();
  const novoEmailNormalizado = String(novo_email).toLowerCase().trim();

  const existente = await db.execute<{ id: number }>(sql`
    SELECT id FROM usuarios WHERE email = ${emailAtualNormalizado}
  `);

  if (existente.rows.length === 0) {
    return NextResponse.json(
      { ok: false, mensagem: "Nenhum usuário encontrado com esse email atual." },
      { status: 404 }
    );
  }

  const novoHash = hashSenha(nova_senha);

  await db.execute(sql`
    UPDATE usuarios
    SET email = ${novoEmailNormalizado}, senha_hash = ${novoHash}
    WHERE email = ${emailAtualNormalizado}
  `);

  return NextResponse.json({
    ok: true,
    mensagem: "Email e senha atualizados. Use as novas credenciais para entrar.",
  });
}
