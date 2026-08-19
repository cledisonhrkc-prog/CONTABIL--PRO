import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { listarVinculos, criarVinculo, type TipoVinculo } from "@/lib/dp";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const colaboradorId = searchParams.get("colaboradorId");
    return listarVinculos(ctx.empresaId, {
      colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
      tipoVinculo: (searchParams.get("tipoVinculo") as TipoVinculo) || undefined,
      apenasAtivos: searchParams.get("todos") !== "true",
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.colaboradorId || !body.tipoVinculo || !body.dataAdmissao) {
      throw new Error("Campos obrigatórios: colaboradorId, tipoVinculo, dataAdmissao");
    }
    return criarVinculo(ctx.empresaId, body);
  });
}
