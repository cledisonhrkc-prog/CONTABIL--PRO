import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { obterColaborador, atualizarColaborador } from "@/lib/dp";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const colaborador = await obterColaborador(ctx.empresaId, Number(id));
    if (!colaborador) {
      const err: any = new Error("Colaborador não encontrado");
      err.status = 404;
      throw err;
    }
    return colaborador;
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    return atualizarColaborador(ctx.empresaId, Number(id), body);
  });
}
