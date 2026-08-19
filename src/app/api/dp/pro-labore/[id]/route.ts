import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { marcarProLaborePago } from "@/lib/dp";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    if (!body.dataPagamento) {
      throw new Error("Campo obrigatório: dataPagamento");
    }
    return marcarProLaborePago(ctx.empresaId, Number(id), body.dataPagamento);
  });
}
