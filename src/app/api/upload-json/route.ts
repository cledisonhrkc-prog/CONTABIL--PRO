// PLANO B — endpoint que recebe NF-e JÁ PARSEADA em JSON (feito no navegador).
// Payload ~20x menor que XML, cabe MUITAS notas por request (200-500),
// respeitando os 4.5MB da Vercel sem esforço.

import { NextResponse } from "next/server";
import { contabilizarLote } from "@/lib/contabilizador";
import { garantirEmpresa, getEmpresaAtiva } from "@/lib/empresa";
import type { NF } from "@/lib/nfe-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = ["gru1"];

type Body = {
  cnpj?: string;
  nome?: string;
  regime?: string;
  anexo?: string;
  rbt12?: number | null;
  nfs: NF[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const nfs = Array.isArray(body?.nfs) ? body.nfs : [];
    if (nfs.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhuma nota enviada" }, { status: 400 });
    }

    const regime = body.regime ?? "SIMPLES";
    const anexo = body.anexo ?? "I";
    const rbt12 = body.rbt12 ?? null;
    const cnpj = (body.cnpj ?? "03000000000191").replace(/\D/g, "");
    const nome = body.nome ?? "EMPRESA IMPORTADA";

    let emp = await getEmpresaAtiva();
    if (!emp || emp.cnpj !== cnpj) {
      emp = await garantirEmpresa({ cnpj, nome, regime, anexo_simples: anexo });
    }

    const result = await contabilizarLote({
      empresa_id: emp.id,
      regime: regime as "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL",
      rbt12,
      anexo,
      nfs,
    });

    return NextResponse.json({
      ok: true,
      processadas: nfs.length,
      result,
    });
  } catch (e) {
    console.error("upload-json error:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
