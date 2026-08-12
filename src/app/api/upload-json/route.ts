// PLANO B — endpoint que recebe NF-e JÁ PARSEADA em JSON (feito no navegador).
// Payload ~20x menor que XML, cabe MUITAS notas por request (200-500),
// respeitando os 4.5MB da Vercel sem esforço.

import { NextResponse } from "next/server";
import { contabilizarLote } from "@/lib/contabilizador";
import { garantirEmpresa, getEmpresaAtiva } from "@/lib/empresa";
import { crtParaRegime } from "@/lib/nfe-parser";
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
  crt?: string | null;
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

    const anexo = body.anexo ?? "I";
    const rbt12 = body.rbt12 ?? null;
    const cnpj = (body.cnpj ?? "").replace(/\D/g, "");

    // Se já existe empresa cadastrada, usa ela e IGNORA qualquer coisa vinda do body.
    // Nunca sobrescreve com dado do formulário — evita repetir o bug do CNPJ fixo.
    let emp = await getEmpresaAtiva();

    if (!emp) {
      // Nenhuma empresa cadastrada ainda. O CNPJ precisa ter vindo do navegador
      // já detectado automaticamente a partir do lote de XMLs (ver page.tsx).
      if (!cnpj) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Nenhuma empresa cadastrada e nenhum CNPJ foi detectado automaticamente nos XMLs. Selecione os arquivos novamente.",
          },
          { status: 400 }
        );
      }
      const nome = body.nome || "EMPRESA (nome nao identificado no XML)";
      const regime = body.regime || crtParaRegime(body.crt ?? null);
      emp = await garantirEmpresa({ cnpj, nome, regime, anexo_simples: anexo });
    }

    const regimeEmpresa = (emp.regime ?? "SIMPLES") as "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";
    const anexoEmpresa = emp.anexo_simples ?? anexo;

    const result = await contabilizarLote({
      empresa_id: emp.id,
      regime: regimeEmpresa,
      rbt12,
      anexo: anexoEmpresa,
      nfs,
    });

    return NextResponse.json({
      ok: true,
      empresa: { cnpj: emp.cnpj, nome: emp.nome, regime: regimeEmpresa },
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
