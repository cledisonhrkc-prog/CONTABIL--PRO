import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { processarPagamentoAutonomo } from "@/lib/dp";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.colaboradorId || !body.competencia || !body.valorBruto) {
      throw new Error("Campos obrigatórios: colaboradorId, competencia, valorBruto");
    }
    return processarPagamentoAutonomo(ctx.empresaId, body);
  });
}
