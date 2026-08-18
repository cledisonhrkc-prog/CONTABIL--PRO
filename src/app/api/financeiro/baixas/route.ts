import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { baixarConta, cancelarBaixa } from "@/lib/financeiro";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    const { tipo, contaId, valor, dataBaixa, contaBancariaId, formaPagamento, observacao } = body;

    if (!tipo || !contaId || !valor || !dataBaixa || !contaBancariaId) {
      throw new Error("Campos obrigatórios: tipo, contaId, valor, dataBaixa, contaBancariaId");
    }
    if (tipo !== "RECEBER" && tipo !== "PAGAR") {
      throw new Error("tipo deve ser RECEBER ou PAGAR");
    }

    return baixarConta({
      empresaId: ctx.empresaId,
      tipo,
      contaId: Number(contaId),
      valor: Number(valor),
      dataBaixa,
      contaBancariaId: Number(contaBancariaId),
      formaPagamento,
      observacao,
      usuarioId: ctx.usuarioId,
    });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.baixaId) throw new Error("baixaId é obrigatório");
    return cancelarBaixa({
      empresaId: ctx.empresaId,
      baixaId: Number(body.baixaId),
      usuarioId: ctx.usuarioId,
    });
  });
}
