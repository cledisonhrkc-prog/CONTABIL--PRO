import { NextRequest, NextResponse } from "next/server";
import { recalcularCmvReal } from "@/lib/contabilizador";
import { db } from "@/db";
import { empresas } from "@/db/schema";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const empresaIdParam = searchParams.get("empresa_id");

  let empresaId: number | null = empresaIdParam ? Number(empresaIdParam) : null;

  if (!empresaId) {
    const primeira = await db.select().from(empresas).limit(1);
    empresaId = primeira[0]?.id ?? null;
  }

  if (!empresaId) {
    return NextResponse.json(
      { ok: false, mensagem: "Nenhuma empresa encontrada." },
      { status: 400 }
    );
  }

  const resultado = await recalcularCmvReal(empresaId);
  return NextResponse.json(resultado);
}
