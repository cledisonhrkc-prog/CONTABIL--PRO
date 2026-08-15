import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { verificarTokenSessao, ehAdmin } from "@/lib/auth";
import { ensureUsuarioEmpresasTable } from "@/lib/empresa";

async function exigirAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) return null;
  const admin = await ehAdmin(sessao.email);
  if (!admin) return null;
  return sessao;
}

// Redefine (substitui) quais empresas um usuário já existente pode
// acessar. Útil quando uma empresa é apagada/recriada com ID novo e o
// vínculo antigo fica "órfão", ou quando você simplesmente quer mudar
// o acesso de alguém sem apagar e recriar a conta inteira.
export async function POST(req: NextRequest) {
  const sessao = await exigirAdmin();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem redefinir vínculos." },
      { status: 403 }
    );
  }
  await ensureUsuarioEmpresasTable();

  const { usuario_id, empresa_ids } = await req.json();

  if (!usuario_id) {
    return NextResponse.json(
      { ok: false, mensagem: "usuario_id é obrigatório." },
      { status: 400 }
    );
  }

  const ids: number[] = Array.isArray(empresa_ids) ? empresa_ids.map(Number) : [];

  await db.execute(sql`
    DELETE FROM usuario_empresas WHERE usuario_id = ${usuario_id}
  `);

  for (const empresaId of ids) {
    await db.execute(sql`
      INSERT INTO usuario_empresas (usuario_id, empresa_id)
      VALUES (${usuario_id}, ${empresaId})
      ON CONFLICT DO NOTHING
    `);
  }

  return NextResponse.json({
    ok: true,
    mensagem:
      ids.length > 0
        ? `Vínculos atualizados: usuário agora acessa ${ids.length} empresa(s).`
        : "Vínculos removidos: usuário sem nenhuma empresa vinculada agora.",
  });
}
