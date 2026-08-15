import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";
import { gerarFechamentoMensal } from "@/lib/fechamento-mensal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const empresaId = Number(searchParams.get("empresa_id"));
  const mes = searchParams.get("mes"); // "2026-07"

  if (!empresaId || !mes) {
    return NextResponse.json(
      { ok: false, mensagem: "empresa_id e mes (formato AAAA-MM) são obrigatórios." },
      { status: 400 }
    );
  }

  const permitidos = await empresasPermitidasIds(usuario);
  const permitido = permitidos === null || permitidos.includes(empresaId);
  if (!permitido) {
    return NextResponse.json(
      { ok: false, mensagem: "Você não tem permissão para acessar esta empresa." },
      { status: 403 }
    );
  }

  const dados = await gerarFechamentoMensal(empresaId, mes);
  if (!dados) {
    return NextResponse.json({ ok: false, mensagem: "Empresa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, dados });
}
