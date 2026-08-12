import { NextResponse } from "next/server";
import { parseNfeXml, detectarEmpresaPrincipal, crtParaRegime } from "@/lib/nfe-parser";
import { contabilizarLote } from "@/lib/contabilizador";
import { garantirEmpresa, getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = ["gru1"]; // São Paulo

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const rbt12Str = form.get("rbt12") as string | null;
    const rbt12 = rbt12Str ? Number(rbt12Str) : null;

    if (!files.length) return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado" }, { status: 400 });

    // Lê o texto de todos os XMLs uma vez só (usado tanto na detecção quanto no parse individual)
    const textos = await Promise.all(files.map((f) => f.text()));

    // 1) Se já existe empresa cadastrada, usa ela. NUNCA sobrescreve com dado do formulário.
    let emp = await getEmpresaAtiva();

    // 2) Se não existe empresa nenhuma ainda, detecta automaticamente pelo lote de XMLs
    //    (conta qual CNPJ mais aparece como emit/dest em todo o lote).
    if (!emp) {
      const detectada = detectarEmpresaPrincipal(textos);
      if (!detectada) {
        return NextResponse.json(
          { ok: false, error: "Não foi possível identificar a empresa a partir dos XMLs enviados." },
          { status: 400 }
        );
      }
      const regimeDetectado = crtParaRegime(detectada.crt);
      emp = await garantirEmpresa({
        cnpj: detectada.cnpj,
        nome: detectada.nome,
        regime: regimeDetectado,
        anexo_simples: "I",
      });
    }

    const nfs = [];
    const erros: Array<{ arquivo: string; erro: string }> = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const nf = parseNfeXml(textos[i], emp.cnpj);
        nfs.push(nf);
      } catch (e) {
        erros.push({ arquivo: files[i].name, erro: (e as Error).message.substring(0, 200) });
      }
    }

    const regimeEmpresa = (emp.regime ?? "SIMPLES") as "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";
    const anexoEmpresa = emp.anexo_simples ?? "I";

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
      erros,
      result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
