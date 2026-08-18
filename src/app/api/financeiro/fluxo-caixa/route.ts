import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { fluxoCaixaCompleto } from "@/lib/financeiro";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const meses = Number(new URL(req.url).searchParams.get("meses") || 6);
    return fluxoCaixaCompleto(ctx.empresaId, meses);
  });
}
