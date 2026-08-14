import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureUsuariosTable, verificarTokenSessao } from "@/lib/auth";

// Rota de uso único: torna o usuário ATUALMENTE LOGADO em admin, mas só
// funciona se ainda não existir nenhum admin no sistema. Depois que o
// primeiro admin é criado, esta rota se bloqueia sozinha. Não aceita
// email por parâmetro — só promove a própria conta logada, para evitar
// que alguém tente promover a conta de outra pessoa.
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);

  if (!sessao) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  await ensureUsuariosTable();

  const existentes = await db.execute<{ total: string }>(
    sql`SELECT COUNT(*)::text AS total FROM usuarios WHERE admin = true`
  );
  const total = Number(existentes.rows[0]?.total ?? 0);

  if (total > 0) {
    return NextResponse.json(
      {
        ok: false,
        mensagem: "Já existe um administrador cadastrado. Esta rota só funciona uma vez.",
      },
      { status: 403 }
    );
  }

  await db.execute(sql`
    UPDATE usuarios SET admin = true WHERE email = ${sessao.email}
  `);

  return NextResponse.json({ ok: true, mensagem: "Você agora é administrador." });
}
