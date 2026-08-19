import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { encerrarVinculo } from "@/lib/dp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    if (!body.dataDemissao) {
      throw new Error("Campo obrigatório: dataDemissao");
    }
    return encerrarVinculo(ctx.empresaId, Number(id), body.dataDemissao);
  });
}
