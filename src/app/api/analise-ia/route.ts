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

      // Contexto do regime construído DINAMICAMENTE a partir do dado real
      // da empresa (nunca fixo) — é aqui que estava o bug: antes, essa
      // parte do prompt dizia sempre "farmácia no Simples Nacional",
      // não importa qual empresa estivesse sendo analisada.
      const regimeTexto =
        dossie.empresa.regime === "SIMPLES"
          ? `Simples Nacional${dossie.empresa.anexo_simples ? " Anexo " + dossie.empresa.anexo_simples : ""}. Neste regime, produtos monofásicos (ex: NCM 3004) com CST 04/05/06 não geram crédito de PIS/COFINS — isso é CORRETO, não é erro.`
          : dossie.empresa.regime === "LUCRO_PRESUMIDO"
          ? "Lucro Presumido. Neste regime, o IRPJ/CSLL usa base de cálculo PRESUMIDA sobre a receita bruta (não sobre o lucro real), com créditos de PIS/COFINS regidos por regras próprias do regime cumulativo/não-cumulativo conforme a atividade."
          : dossie.empresa.regime === "LUCRO_REAL"
          ? "Lucro Real. Neste regime, o IRPJ/CSLL incide sobre o lucro contábil real apurado, com direito a créditos amplos de PIS/COFINS não-cumulativo sobre insumos."
          : "Regime não identificado com precisão — analise com cautela, sem presumir características do negócio.";

      const prompt = `Voce e um auditor fiscal brasileiro senior (CRC). Analise este dossie de NF-e de forma tecnica, objetiva e EQUILIBRADA. Se o lote estiver em conformidade, diga claramente que esta conforme - NAO invente problemas. Aponte erro APENAS com base legal concreta e citavel.

Empresa analisada: ${dossie.empresa.nome} (CNPJ ${dossie.empresa.cnpj})
Regime tributário: ${regimeTexto}

NAO presuma o ramo de atividade da empresa (farmácia, comércio, indústria, serviço etc.) além do que os dados do dossiê (NCMs, CFOPs, descrições de produtos) já indicam. Baseie-se apenas nos dados apresentados abaixo.

${txt}

Responda em portugues:
1. CONFORMIDADE: o lote esta conforme? Se sim, afirme.
2. INTEGRIDADE: os totais fazem sentido?
3. RECOMENDACAO: PROSSEGUIR ou revisar?
4. Observacoes tecnicas, sem alarmismo.`;

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
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      analise_claude = data.content?.[0]?.text ?? null;
    } catch (e) {
      analise_claude = "Erro ao chamar Claude: " + String(e);
    }
  }

  return NextResponse.json({ ok: true, dossie, analise_claude });
}
