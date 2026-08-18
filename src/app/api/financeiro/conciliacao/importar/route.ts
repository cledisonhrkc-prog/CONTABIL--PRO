import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { importarExtrato } from "@/lib/financeiro";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.contaBancariaId || !Array.isArray(body.linhas)) {
      throw new Error("contaBancariaId e linhas são obrigatórios");
    }
    return importarExtrato({
      empresaId: ctx.empresaId,
      contaBancariaId: Number(body.contaBancariaId),
      linhas: body.linhas,
    });
  });
}
