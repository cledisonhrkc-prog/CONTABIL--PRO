import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { calcularFerias, listarFerias } from "@/lib/dp";

export async function GET() {
  return withAuth(async (ctx) => listarFerias(ctx.empresaId));
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.vinculoId || !body.periodoAquisitivoInicio || !body.periodoAquisitivoFim || !body.dataInicioGozo || !body.dataFimGozo || !body.diasGozo) {
      throw new Error("Campos obrigatórios: vinculoId, periodoAquisitivoInicio, periodoAquisitivoFim, dataInicioGozo, dataFimGozo, diasGozo");
    }
    return calcularFerias(ctx.empresaId, body);
  });
}
