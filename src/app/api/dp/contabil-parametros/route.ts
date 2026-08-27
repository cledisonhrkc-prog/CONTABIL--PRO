import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { salvarParametrosContabilDP } from "@/lib/integracaoContabilDP";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    const obrigatorios = [
      "contaDebitoDespesa",
      "contaCreditoInssPassivo",
      "contaCreditoFgtsPassivo",
      "contaCreditoIrrfPassivo",
      "contaCreditoSalariosAPagar",
    ];
    for (const campo of obrigatorios) {
      if (!body[campo]) throw new Error(`Campo obrigatório ausente: ${campo}`);
    }
    return salvarParametrosContabilDP(ctx.empresaId, body);
  });
}
