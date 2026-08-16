import { NextResponse } from "next/server";
import { gerarDossieIA, formatarDossieTexto } from "@/lib/analise-ia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function montarPrompt(dossie: Awaited<ReturnType<typeof gerarDossieIA>>, txt: string): string {
  if (!dossie) return "";

  const regimeTexto =
    dossie.empresa.regime === "SIMPLES"
      ? `Simples Nacional${dossie.empresa.anexo_simples ? " Anexo " + dossie.empresa.anexo_simples : ""}. Neste regime, produtos monofásicos (ex: NCM 3004) com CST 04/05/06 não geram crédito de PIS/COFINS — isso é CORRETO, não é erro.`
      : dossie.empresa.regime === "LUCRO_PRESUMIDO"
      ? "Lucro Presumido. Neste regime, o IRPJ/CSLL usa base de cálculo PRESUMIDA sobre a receita bruta (não sobre o lucro real). Base de cálculo: 8% (IRPJ) e 12% (CSLL) para comércio/indústria; 32% para serviços."
      : dossie.empresa.regime === "LUCRO_REAL"
      ? "Lucro Real. Neste regime, o IRPJ/CSLL incide sobre o lucro contábil real apurado, com direito a créditos amplos de PIS/COFINS não-cumulativo sobre insumos."
      : "Regime não identificado com precisão — analise com cautela, sem presumir características do negócio.";

  return `Você é um auditor fiscal brasileiro sênior (CRC). Analise este dossiê de NF-e de forma técnica, objetiva e equilibrada.

### REGRAS OBRIGATÓRIAS (NÃO DESCUMPRIR):

1. NÃO recalcule os impostos do zero.
2. Use exclusivamente os valores que já estão apresentados no dossiê.
3. Sua função é apenas VERIFICAR se os valores do dossiê estão coerentes com a legislação.
4. Se encontrar divergência, aponte de forma objetiva e mostre a conta correta.
5. NÃO invente hipóteses de incentivo fiscal, redução de base, PAT ou qualquer benefício que não esteja explicitamente informado no dossiê.
6. Para Lucro Presumido:
   - Comércio / indústria / venda de mercadoria → base 8% (IRPJ) e 12% (CSLL)
   - Serviços → base 32%
   - Use a base correta conforme CFOP e NCM predominante.
7. Se o lote estiver em conformidade, diga claramente que está conforme. NÃO invente problemas.

Empresa analisada: ${dossie.empresa.nome} (CNPJ ${dossie.empresa.cnpj})
Regime tributário: ${regimeTexto}

NÃO presuma o ramo de atividade da empresa além do que os dados do dossiê (NCMs, CFOPs, descrições) já indicam.

${txt}

Responda em português com esta estrutura:

1. CONFORMIDADE: o lote está conforme? Se sim, afirme.
2. INTEGRIDADE: os totais fazem sentido? (Balanço e DRE)
3. ANÁLISE DOS IMPOSTOS: confira os valores já apresentados no dossiê (não recalcule do zero).
4. OBSERVAÇÕES TÉCNICAS: apenas se houver algo relevante e fundamentado.
5. RECOMENDAÇÃO: PROSSEGUIR ou revisar?`;
}

async function chamarClaude(prompt: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
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
    return data.content?.[0]?.text ?? null;
  } catch (e) {
    return "Erro ao chamar Claude: " + String(e);
  }
}

async function chamarDeepSeek(prompt: string): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    return "Erro ao chamar DeepSeek: " + String(e);
  }
}

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

  let analise_claude: string | null = null;
  let analise_deepseek: string | null = null;

  if (analisar) {
    const txt = formatarDossieTexto(dossie);
    const prompt = montarPrompt(dossie, txt);

    // Roda as duas IAs em paralelo — uma não espera a outra terminar.
    const [claudeResult, deepseekResult] = await Promise.all([
      chamarClaude(prompt),
      chamarDeepSeek(prompt),
    ]);
    analise_claude = claudeResult;
    analise_deepseek = deepseekResult;
  }

  return NextResponse.json({ ok: true, dossie, analise_claude, analise_deepseek });
}


