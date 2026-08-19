import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { salvarEndereco } from "@/lib/dp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    return salvarEndereco(ctx.empresaId, Number(id), body);
  });
}
