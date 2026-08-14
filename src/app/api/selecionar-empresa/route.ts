import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  const { empresa_id } = await req.json();
  if (!empresa_id) {
    return NextResponse.json({ ok: false, mensagem: "empresa_id é obrigatório." }, { status: 400 });
  }

  const permitidos = await empresasPermitidasIds(usuario);
  const permitido = permitidos === null || permitidos.includes(Number(empresa_id));

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
