import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { processarFolhaCLTLote } from "@/lib/dp";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.competencia) {
      throw new Error("Campo obrigatório: competencia (formato YYYY-MM)");
    }
    return processarFolhaCLTLote(ctx.empresaId, body.competencia);
  });
}
