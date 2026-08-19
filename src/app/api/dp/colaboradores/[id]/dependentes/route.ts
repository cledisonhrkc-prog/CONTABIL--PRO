import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { adicionarDependente } from "@/lib/dp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    if (!body.nomeCompleto || !body.parentesco) {
      throw new Error("Campos obrigatórios: nomeCompleto, parentesco");
    }
    return adicionarDependente(ctx.empresaId, Number(id), body);
  });
}
