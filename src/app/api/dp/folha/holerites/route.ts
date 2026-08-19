import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { listarHolerites } from "@/lib/dp";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    return listarHolerites(ctx.empresaId, {
      competencia: searchParams.get("competencia") || undefined,
    });
  });
}
