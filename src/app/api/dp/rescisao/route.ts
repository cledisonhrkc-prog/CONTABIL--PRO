import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { calcularRescisao, listarRescisoes, type MotivoRescisao } from "@/lib/dp";

export async function GET() {
  return withAuth(async (ctx) => listarRescisoes(ctx.empresaId));
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.vinculoId || !body.dataDemissao || !body.motivo) {
      throw new Error("Campos obrigatórios: vinculoId, dataDemissao, motivo");
    }
    return calcularRescisao(ctx.empresaId, {
      vinculoId: Number(body.vinculoId),
      dataDemissao: body.dataDemissao,
      motivo: body.motivo as MotivoRescisao,
    });
  });
}
