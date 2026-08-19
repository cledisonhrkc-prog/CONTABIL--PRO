import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { listarProLabore, criarPagamentoProLabore, type StatusProLabore } from "@/lib/dp";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    return listarProLabore(ctx.empresaId, {
      competencia: searchParams.get("competencia") || undefined,
      vinculoId: searchParams.get("vinculoId") ? Number(searchParams.get("vinculoId")) : undefined,
      status: (searchParams.get("status") as StatusProLabore) || undefined,
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.vinculoId || !body.competencia || !body.valorBruto) {
      throw new Error("Campos obrigatórios: vinculoId, competencia, valorBruto");
    }
    return criarPagamentoProLabore(ctx.empresaId, body);
  });
}
