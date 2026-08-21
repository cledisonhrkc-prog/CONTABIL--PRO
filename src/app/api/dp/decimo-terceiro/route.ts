import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { calcularDecimoTerceiro, listarDecimoTerceiro } from "@/lib/dp";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano");
    return listarDecimoTerceiro(ctx.empresaId, { ano: ano ? Number(ano) : undefined });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.vinculoId || !body.ano || !body.parcela) {
      throw new Error("Campos obrigatórios: vinculoId, ano, parcela (1 ou 2)");
    }
    return calcularDecimoTerceiro(ctx.empresaId, body);
  });
}
