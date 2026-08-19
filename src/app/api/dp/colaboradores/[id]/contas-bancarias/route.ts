import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { adicionarContaBancaria } from "@/lib/dp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    if (!body.bancoCodigo || !body.agencia || !body.conta) {
      throw new Error("Campos obrigatórios: bancoCodigo, agencia, conta");
    }
    return adicionarContaBancaria(ctx.empresaId, Number(id), body);
  });
}
