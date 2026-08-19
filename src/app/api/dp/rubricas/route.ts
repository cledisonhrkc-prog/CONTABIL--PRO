import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { listarRubricas, criarRubrica } from "@/lib/dp";

export async function GET() {
  return withAuth(async (ctx) => listarRubricas(ctx.empresaId));
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.codigo || !body.nome || !body.tipo || body.valorFixo === undefined) {
      throw new Error("Campos obrigatórios: codigo, nome, tipo, valorFixo");
    }
    return criarRubrica(ctx.empresaId, body);
  });
}
