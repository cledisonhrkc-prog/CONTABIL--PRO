import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { listarContasPagar } from "@/lib/financeiro";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const busca = searchParams.get("busca") || undefined;
    return listarContasPagar(ctx.empresaId, {
      status: status ? status.split(",") : undefined,
      busca,
    });
  });
}
