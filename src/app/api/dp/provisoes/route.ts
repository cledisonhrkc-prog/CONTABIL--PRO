import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { provisionarFeriasDecimoTerceiro, listarProvisoes } from "@/lib/dp";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano");
    return listarProvisoes(ctx.empresaId, { ano: ano ? Number(ano) : undefined });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.vinculoId || !body.competencia) {
      throw new Error("Campos obrigatórios: vinculoId, competencia");
    }
    return provisionarFeriasDecimoTerceiro(ctx.empresaId, body);
  });
}
