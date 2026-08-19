import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { atualizarVinculo } from "@/lib/dp";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    return atualizarVinculo(ctx.empresaId, Number(id), body);
  });
}
