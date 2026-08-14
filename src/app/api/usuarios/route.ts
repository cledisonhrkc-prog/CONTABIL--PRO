import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { hashSenha, ensureUsuariosTable, verificarTokenSessao, ehAdmin } from "@/lib/auth";
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

export async function GET() {
  const sessao = await exigirAdmin();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem acessar." },
      { status: 403 }
    );
  }
  await ensureUsuariosTable();
  await ensureUsuarioEmpresasTable();

  const r = await db.execute<{
    id: number;
    email: string;
    nome: string | null;
    ativo: boolean;
    admin: boolean;
  }>(sql`
    SELECT id, email, nome, ativo, admin FROM usuarios ORDER BY id
  `);

  const usuariosComEmpresas = [];
  for (const u of r.rows) {
    const vinc = await db.execute<{ empresa_id: number }>(sql`
      SELECT empresa_id FROM usuario_empresas WHERE usuario_id = ${u.id}
    `);
    usuariosComEmpresas.push({ ...u, empresa_ids: vinc.rows.map((v) => v.empresa_id) });
  }

  return NextResponse.json({ ok: true, usuarios: usuariosComEmpresas });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirAdmin();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem criar usuários." },
      { status: 403 }
    );
  }
  await ensureUsuariosTable();
  await ensureUsuarioEmpresasTable();

  const { email, senha, nome, empresa_ids } = await req.json();

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

  const inserido = await db.execute<{ id: number }>(sql`
    INSERT INTO usuarios (email, senha_hash, nome, ativo, admin)
    VALUES (${emailNormalizado}, ${hash}, ${nome ?? null}, true, false)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `);

  const novoId = inserido.rows[0]?.id;
  if (!novoId) {
    return NextResponse.json(
      { ok: false, mensagem: "Já existe um usuário com esse email." },
      { status: 409 }
    );
  }

  const ids: number[] = Array.isArray(empresa_ids) ? empresa_ids.map(Number) : [];
  for (const empresaId of ids) {
    await db.execute(sql`
      INSERT INTO usuario_empresas (usuario_id, empresa_id)
      VALUES (${novoId}, ${empresaId})
      ON CONFLICT DO NOTHING
    `);
  }

  return NextResponse.json({ ok: true, mensagem: "Usuário criado.", id: novoId });
}

export async function PATCH(req: NextRequest) {
  const sessao = await exigirAdmin();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem alterar usuários." },
      { status: 403 }
    );
  }
  await ensureUsuariosTable();

  const { id, ativo } = await req.json();
  if (!id || typeof ativo !== "boolean") {
    return NextResponse.json(
      { ok: false, mensagem: "id e ativo são obrigatórios." },
      { status: 400 }
    );
  }

  await db.execute(sql`
    UPDATE usuarios SET ativo = ${ativo} WHERE id = ${id}
  `);

  return NextResponse.json({
    ok: true,
    mensagem: ativo ? "Usuário desbloqueado." : "Usuário bloqueado.",
  });
}
