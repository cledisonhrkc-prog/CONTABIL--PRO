import { NextRequest, NextResponse } from "next/server";
import { classificarAnexo } from "@/lib/classificar-anexo";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cfop = searchParams.get("cfop") ?? "";
  const cnae = searchParams.get("cnae");

  const resultado = await classificarAnexo(cfop ? [cfop] : [], cnae);
  return NextResponse.json(resultado);
}
