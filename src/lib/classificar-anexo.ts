import { db } from "@/db";
import { sql } from "drizzle-orm";

// CFOPs que indicam venda de produção PRÓPRIA (industrialização) → Anexo II.
// Qualquer outro CFOP de venda de mercadoria (5102/6102 etc) → Anexo I.
const CFOP_INDUSTRIA = new Set(["5101", "6101", "5103", "6103"]);
const CFOP_COMERCIO = new Set(["5102", "6102", "5405", "6405", "5401", "6401"]);

export type ResultadoClassificacao = {
  anexo: "I" | "II" | "III" | "IV" | "V" | null;
  fonte: "cfop" | "cnae" | "indeterminado";
  precisaFatorR: boolean;
  cnaeEncontrado?: string;
  descricaoCnae?: string;
  mensagem: string;
};

const AVISO_CPP_ANEXO_IV =
  "IMPORTANTE: no Anexo IV, a CPP (Contribuição Previdenciária Patronal, ~20% da folha de pagamento) NÃO está incluída no DAS — precisa ser recolhida separadamente, todo mês, em guia própria (GPS). O DAS deste Anexo é mais baixo justamente por isso.";

/**
 * Classifica o Anexo do Simples Nacional a partir do CFOP das notas e,
 * quando o CFOP for de serviço (genérico, não diferencia III/IV/V), do
 * CNAE da empresa.
 *
 * Regra de prioridade:
 * 1. Se algum CFOP do lote indicar Indústria → Anexo II (prevalece sobre Comércio)
 * 2. Senão, se algum CFOP indicar Comércio → Anexo I
 * 3. Senão (CFOPs de serviço, ex: 5933/6933, que não diferenciam nada) →
 *    consulta o CNAE na tabela cnae_anexo:
 *    - Se achar e não precisar de Fator R → retorna III ou IV
 *    - Se achar e precisar de Fator R → retorna V como sugestão, mas avisa
 *      que a decisão final entre III e V depende do Fator R (folha de
 *      pagamento ÷ receita 12 meses), que este sistema NÃO calcula hoje
 *      (não temos dado de folha de pagamento) — precisa confirmação humana.
 *    - Se não achar o CNAE na tabela → indeterminado, mantém escolha manual.
 *
 * Anexo IV: recebe aviso adicional sobre a CPP patronal ficar de fora do
 * DAS (precisa ser recolhida separadamente) — regra oficial do Simples
 * Nacional (LC 123/2006), confirmada em fontes de 2026.
 */
export async function classificarAnexo(
  cfops: string[],
  cnae: string | null
): Promise<ResultadoClassificacao> {
  const temIndustria = cfops.some((c) => CFOP_INDUSTRIA.has(c));
  const temComercio = cfops.some((c) => CFOP_COMERCIO.has(c));

  if (temIndustria) {
    return {
      anexo: "II",
      fonte: "cfop",
      precisaFatorR: false,
      mensagem: "Detectado via CFOP: venda de produção própria (Indústria).",
    };
  }

  if (temComercio) {
    return {
      anexo: "I",
      fonte: "cfop",
      precisaFatorR: false,
      mensagem: "Detectado via CFOP: revenda de mercadoria (Comércio).",
    };
  }

  // Nenhum CFOP de comércio/indústria encontrado — provavelmente serviço
  // (CFOP tipo 5933/6933, que é genérico e não diferencia nada sozinho).
  // Precisa do CNAE da empresa pra decidir entre III, IV e V.
  const cnaeLimpo = (cnae ?? "").replace(/\D/g, "");
  if (!cnaeLimpo) {
    return {
      anexo: null,
      fonte: "indeterminado",
      precisaFatorR: false,
      mensagem:
        "Não foi possível detectar automaticamente (CFOP de serviço genérico e CNAE não informado). Selecione manualmente.",
    };
  }

  try {
    const r = await db.execute<{
      anexo_base: number;
      permite_fator_r: boolean;
      descricao: string;
    }>(sql`
      SELECT anexo_base, permite_fator_r, descricao
      FROM cnae_anexo
      WHERE cnae = ${cnaeLimpo}
      LIMIT 1
    `);
    const row = r.rows[0];

    if (!row) {
      return {
        anexo: null,
        fonte: "indeterminado",
        precisaFatorR: false,
        mensagem: `CNAE ${cnaeLimpo} não encontrado na tabela de referência. Selecione o Anexo manualmente.`,
      };
    }

    const anexoMap: Record<number, "III" | "IV" | "V"> = { 3: "III", 4: "IV", 5: "V" };
    const anexoDetectado = anexoMap[row.anexo_base];

    if (row.permite_fator_r) {
      return {
        anexo: anexoDetectado, // sugestão (V), mas pode ser III se Fator R >= 28%
        fonte: "cnae",
        precisaFatorR: true,
        cnaeEncontrado: cnaeLimpo,
        descricaoCnae: row.descricao,
        mensagem: `CNAE ${cnaeLimpo} (${row.descricao}) pode ser Anexo III ou V, dependendo do Fator R (folha de pagamento ÷ receita dos últimos 12 meses). Fator R ≥ 28% = Anexo III; abaixo disso = Anexo V. Este sistema não calcula Fator R automaticamente (não há dado de folha de pagamento) — confirme com a contabilidade responsável antes de contabilizar.`,
      };
    }

    const mensagemBase = `Detectado via CNAE ${cnaeLimpo} (${row.descricao}): Anexo ${anexoDetectado}.`;

    return {
      anexo: anexoDetectado,
      fonte: "cnae",
      precisaFatorR: false,
      cnaeEncontrado: cnaeLimpo,
      descricaoCnae: row.descricao,
      mensagem:
        anexoDetectado === "IV" ? `${mensagemBase} ${AVISO_CPP_ANEXO_IV}` : mensagemBase,
    };
  } catch {
    return {
      anexo: null,
      fonte: "indeterminado",
      precisaFatorR: false,
      mensagem: "Erro ao consultar tabela de CNAEs. Selecione o Anexo manualmente.",
    };
  }
}

/**
 * Retorna a faixa/alíquota oficial de um Anexo para um RBT12 específico.
 * Usa a tabela simples_faixas (populada via /api/setup-cnae-anexo).
 */
export async function obterFaixaSimples(anexoRomano: string, rbt12: number) {
  const anexoNum: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const n = anexoNum[anexoRomano];
  if (!n) return null;

  const r = await db.execute<{
    faixa: number;
    aliquota: string;
    parcela_deduzir: string;
  }>(sql`
    SELECT faixa, aliquota, parcela_deduzir
    FROM simples_faixas
    WHERE anexo = ${n} AND ${rbt12} BETWEEN receita_de AND receita_ate
    LIMIT 1
  `);
  const row = r.rows[0];
  if (!row) return null;

  const aliquotaNominal = Number(row.aliquota);
  const parcela = Number(row.parcela_deduzir);
  const aliquotaEfetiva =
    rbt12 > 0 ? +(((rbt12 * (aliquotaNominal / 100) - parcela) / rbt12) * 100).toFixed(4) : 0;

  return {
    faixa: row.faixa,
    aliquotaNominal,
    parcelaDeduzir: parcela,
    aliquotaEfetiva,
  };
}
