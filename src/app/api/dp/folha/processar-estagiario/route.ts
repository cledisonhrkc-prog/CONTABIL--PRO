import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { processarPagamentoEstagiario } from "@/lib/dp";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.colaboradorId || !body.competencia) {
      throw new Error("Campos obrigatórios: colaboradorId, competencia");
    }
    return processarPagamentoEstagiario(ctx.empresaId, body);
  });
}
