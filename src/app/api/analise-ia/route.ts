import { NextResponse } from "next/server";
import { gerarDossieIA, formatarDossieTexto } from "@/lib/analise-ia";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") ?? "json";
  const analisar = url.searchParams.get("analisar") === "1";

  const dossie = await gerarDossieIA();
  if (!dossie)
    return NextResponse.json({ ok: false, error: "Sem empresa cadastrada" }, { status: 404 });

  if (formato === "texto" || formato === "download") {
    const txt = formatarDossieTexto(dossie);
    if (formato === "download") {
      return new NextResponse(txt, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="dossie_ia_${Date.now()}.md"`,
        },
      });
    }
    return new NextResponse(txt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  let analise_claude = null;
  if (analisar && process.env.ANTHROPIC_API_KEY) {
    try {
      const txt = formatarDossieTexto(dossie);
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Voce e um auditor fiscal brasileiro senior (CRC). Analise este dossie de NF-e ANTES da contabilizacao e responda em portugues, de forma objetiva e tecnica:\n\n${txt}\n\nResponda:\n1. RISCOS FISCAIS: CSTs errados, CFOPs incompativeis, NCMs suspeitos\n2. INTEGRIDADE: totais fazem sentido?\n3. RECOMENDACAO: PROSSEGUIR ou PARAR? Por que?\n4. AUDITORIA R08: NCMs monofasicos com CST errado e credito recuperavel`
          }]
        })
      });
      const data = await resp.json();
      analise_claude = data.content?.[0]?.text ?? null;
    } catch (e) {
      analise_claude = "Erro ao chamar Claude: " + String(e);
    }
  }

  return NextResponse.json({ ok: true, dossie, analise_claude });
}
