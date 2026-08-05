import { NextResponse } from "next/server";
import { parseNfeXml } from "@/lib/nfe-parser";
import { contabilizarLote } from "@/lib/contabilizador";
import { garantirEmpresa, getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const regime = (form.get("regime") as string) ?? "SIMPLES";
    const anexo = (form.get("anexo") as string) ?? "I";
    const rbt12Str = form.get("rbt12") as string | null;
    const rbt12 = rbt12Str ? Number(rbt12Str) : null;
    const cnpj = ((form.get("cnpj") as string) ?? "03000000000191").replace(/\D/g, "");
    const nome = (form.get("nome") as string) ?? "EMPRESA IMPORTADA";

    if (!files.length) return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado" }, { status: 400 });

    let emp = await getEmpresaAtiva();
    if (!emp || emp.cnpj !== cnpj) {
      emp = await garantirEmpresa({ cnpj, nome, regime, anexo_simples: anexo });
    }

    const nfs = [];
    const erros: Array<{ arquivo: string; erro: string }> = [];
    for (const f of files) {
      try {
        const xml = await f.text();
        const nf = parseNfeXml(xml, emp.cnpj);
        nfs.push(nf);
      } catch (e) {
        erros.push({ arquivo: f.name, erro: (e as Error).message.substring(0, 200) });
      }
    }

    const result = await contabilizarLote({
      empresa_id: emp.id,
      regime: regime as "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL",
      rbt12,
      anexo,
      nfs,
    });

    return NextResponse.json({ ok: true, processadas: nfs.length, erros, result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
