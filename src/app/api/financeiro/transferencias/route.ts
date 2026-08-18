import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { criarTransferencia } from "@/lib/financeiro";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.data || !body.valor || !body.contaOrigemId || !body.contaDestinoId) {
      throw new Error("Campos obrigatórios: data, valor, contaOrigemId, contaDestinoId");
    }
    return criarTransferencia({
      empresaId: ctx.empresaId,
      data: body.data,
      valor: Number(body.valor),
      contaOrigemId: Number(body.contaOrigemId),
      contaDestinoId: Number(body.contaDestinoId),
      descricao: body.descricao || "Transferência entre contas",
      observacao: body.observacao,
      usuarioId: ctx.usuarioId,
    });
  });
}
