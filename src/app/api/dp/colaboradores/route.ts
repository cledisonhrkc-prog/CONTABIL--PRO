import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { listarColaboradores, criarColaborador, type TipoPessoa } from "@/lib/dp";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    return listarColaboradores(ctx.empresaId, {
      busca: searchParams.get("busca") || undefined,
      tipoPessoa: (searchParams.get("tipoPessoa") as TipoPessoa) || undefined,
      apenasAtivos: searchParams.get("todos") !== "true",
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.cpf || !body.nomeCompleto || !body.tipoPessoa) {
      throw new Error("Campos obrigatórios: cpf, nomeCompleto, tipoPessoa");
    }
    return criarColaborador(ctx.empresaId, body);
  });
}
