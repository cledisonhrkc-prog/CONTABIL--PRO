import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { cancelarPagamentoProLabore } from "@/lib/dp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return cancelarPagamentoProLabore(ctx.empresaId, Number(id), body?.motivo);
  });
}
