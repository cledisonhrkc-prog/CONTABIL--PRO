import { NextRequest, NextResponse } from "next/server";
import { classificarAnexo } from "@/lib/classificar-anexo";

export async function POST(req: NextRequest) {
  const { cfops, cnae } = await req.json();
  const resultado = await classificarAnexo(Array.isArray(cfops) ? cfops : [], cnae ?? null);
  return NextResponse.json(resultado);
}
