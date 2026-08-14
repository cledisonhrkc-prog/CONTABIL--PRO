// REFORMA TRIBUTÁRIA — EC 132/2023 + LC 214/2025
// Cronograma oficial de implementação:
//   2026: CBS 0,9% e IBS 0,1% (teste, compensáveis com PIS/COFINS)
//   2027: CBS a alíquota cheia (~8,8%) SUBSTITUI PIS/COFINS (extintos)
//         IPI → zero para maioria (exceto ZFM)
//         Imposto Seletivo (IS) começa a ser cobrado
//   2029-2032: IBS gradual, ICMS/ISS decrescentes
//   2033: IBS a alíquota cheia (~17,7%), ICMS e ISS extintos
// =============================================================================

import { db } from "@/db";
import { sql } from "drizzle-orm";

// Alíquotas de referência publicadas pelo Ministério da Fazenda em 2025
// (podem sofrer ajuste anual pela LDO, mas são as vigentes hoje — servem
// como valor PADRÃO quando não há nenhuma vigência cadastrada na tabela
// aliquotas_reforma para o período)
export const CBS_ALIQUOTA_2026 = 0.009; // 0,9% teste
export const IBS_ALIQUOTA_2026 = 0.001; // 0,1% teste
export const CBS_ALIQUOTA_2027 = 0.088; // 8,8% - alíquota cheia federal
export const IBS_ALIQUOTA_2029_INICIAL = 0.001; // começa muito pequena, sobe até 17,7% em 2033
export const IBS_ALIQUOTA_2033 = 0.177; // 17,7% - alíquota cheia de referência

// Alíquota de referência para o Imposto Seletivo (IS - "imposto do pecado")
// Percentuais indicativos do MF; alíquota final vem em Decreto anual.
export const IS_ALIQUOTAS: Record<string, number> = {
  BEBIDA_ACUCARADA: 0.03,   // Refrigerantes
  BEBIDA_ALCOOLICA: 0.10,   // Cervejas, destilados, vinhos
  CIGARRO: 0.60,            // Tabaco (alta)
  VEICULO_POLUENTE: 0.06,   // Veículos combustão
  MINERACAO: 0.005,         // Bens minerais
  APOSTA: 0.12,             // Apostas/loterias
};

// NCMs sujeitos ao Imposto Seletivo (lista consolidada da Câmara + LC 214/2025)
export const NCM_SELETIVOS: Record<string, string> = {
  // Bebidas açucaradas
  "22021000": "BEBIDA_ACUCARADA",
  "22029900": "BEBIDA_ACUCARADA",
  // Bebidas alcoólicas
  "22030000": "BEBIDA_ALCOOLICA",
  "22041000": "BEBIDA_ALCOOLICA",
  "22042100": "BEBIDA_ALCOOLICA",
  "22051000": "BEBIDA_ALCOOLICA",
  "22060000": "BEBIDA_ALCOOLICA",
  "22071000": "BEBIDA_ALCOOLICA",
  "22082000": "BEBIDA_ALCOOLICA",
  "22083000": "BEBIDA_ALCOOLICA",
  "22084000": "BEBIDA_ALCOOLICA",
  "22087000": "BEBIDA_ALCOOLICA",
  // Cigarros e tabaco
  "24021000": "CIGARRO",
  "24022000": "CIGARRO",
  "24029000": "CIGARRO",
  "24031100": "CIGARRO",
  "24031900": "CIGARRO",
  // Veículos com motor a combustão
  "87032100": "VEICULO_POLUENTE",
  "87032200": "VEICULO_POLUENTE",
  "87032300": "VEICULO_POLUENTE",
  "87032400": "VEICULO_POLUENTE",
  "87033100": "VEICULO_POLUENTE",
  "87033200": "VEICULO_POLUENTE",
  "87033300": "VEICULO_POLUENTE",
};

export type ModoReforma = "PRE_REFORMA" | "TRANSICAO_2026" | "REFORMA_2027" | "REFORMA_2029" | "REFORMA_2033";

/**
 * Determina o modo da reforma para uma data de emissão de nota.
 */
export function modoReformaParaData(dataEmissao: string): ModoReforma {
  const ano = parseInt(dataEmissao.substring(0, 4), 10);
  if (ano <= 2025) return "PRE_REFORMA";
  if (ano === 2026) return "TRANSICAO_2026";
  if (ano >= 2027 && ano <= 2028) return "REFORMA_2027";
  if (ano >= 2029 && ano <= 2032) return "REFORMA_2029";
  return "REFORMA_2033";
}

export type ImpostosReforma = {
  cbs: number;
  ibs: number;
  is: number;
  extingue_pis_cofins: boolean;
  extingue_ipi: boolean;
  extingue_icms_iss: boolean;
  ncm_seletivo: string | null;
};

// ============================================================
// VIGÊNCIA DE ALÍQUOTA CONFIGURÁVEL
// ============================================================

export type AliquotasReformaVigentes = {
  cbs2026: number;
  ibs2026: number;
  cbs2027: number;
  ibs2029inicio: number;
  ibs2033: number;
};

export async function ensureAliquotasReformaTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS aliquotas_reforma (
      id SERIAL PRIMARY KEY,
      tributo VARCHAR(30) NOT NULL,
      aliquota NUMERIC(8,5) NOT NULL,
      vigencia_inicio DATE NOT NULL,
      vigencia_fim DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// Cache simples em memória (só dura enquanto a função da Vercel estiver
// "quente"). Evita consultar o banco em toda nota — as alíquotas de
// referência mudam no máximo uma vez por ano por lei, não precisa
// buscar de novo a cada contabilização.
let cacheAliquotas: { valores: AliquotasReformaVigentes; expiraEm: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Busca as alíquotas de referência VIGENTES HOJE na tabela
 * aliquotas_reforma (se algum admin já tiver cadastrado um valor
 * atualizado por lei/decreto/portaria). Para qualquer tributo sem
 * registro vigente, usa a constante fixa do código como padrão —
 * ou seja, se a tabela estiver vazia (caso de hoje), o resultado é
 * IDÊNTICO ao comportamento anterior a esta função existir.
 */
export async function buscarAliquotasVigentes(): Promise<AliquotasReformaVigentes> {
  if (cacheAliquotas && cacheAliquotas.expiraEm > Date.now()) {
    return cacheAliquotas.valores;
  }

  const padrao: AliquotasReformaVigentes = {
    cbs2026: CBS_ALIQUOTA_2026,
    ibs2026: IBS_ALIQUOTA_2026,
    cbs2027: CBS_ALIQUOTA_2027,
    ibs2029inicio: IBS_ALIQUOTA_2029_INICIAL,
    ibs2033: IBS_ALIQUOTA_2033,
  };

  try {
    await ensureAliquotasReformaTable();
    const r = await db.execute<{ tributo: string; aliquota: string }>(sql`
      SELECT tributo, aliquota FROM aliquotas_reforma
      WHERE vigencia_inicio <= CURRENT_DATE
        AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)
      ORDER BY vigencia_inicio DESC
    `);

    const jaAplicado = new Set<string>();
    for (const row of r.rows) {
      // Se houver mais de uma vigência válida pro mesmo tributo,
      // usa a mais recente (a query já vem ordenada assim).
      if (jaAplicado.has(row.tributo)) continue;
      jaAplicado.add(row.tributo);
      const valor = Number(row.aliquota);
      if (row.tributo === "CBS_2026") padrao.cbs2026 = valor;
      if (row.tributo === "IBS_2026") padrao.ibs2026 = valor;
      if (row.tributo === "CBS_2027") padrao.cbs2027 = valor;
      if (row.tributo === "IBS_2029_INICIAL") padrao.ibs2029inicio = valor;
      if (row.tributo === "IBS_2033") padrao.ibs2033 = valor;
    }
  } catch {
    // Qualquer erro de banco: segue com os valores padrão, nunca
    // deixa a contabilização travar por causa disso.
  }

  cacheAliquotas = { valores: padrao, expiraEm: Date.now() + CACHE_TTL_MS };
  return padrao;
}

/**
 * Calcula impostos da Reforma Tributária para um item.
 * @param baseCalculo valor do produto/serviço
 * @param ncm NCM do produto (para IS)
 * @param modo modo da reforma
 * @param ano ano de emissão da nota (necessário para escalonar o IBS em 2029-2032)
 * @param aliquotas alíquotas vigentes (opcional — se não vier, usa as
 *   constantes fixas do código, comportamento idêntico ao de sempre)
 */
export function calcularImpostosReforma(
  baseCalculo: number,
  ncm: string,
  modo: ModoReforma,
  ano?: number,
  aliquotas?: AliquotasReformaVigentes
): ImpostosReforma {
  const ncmLimpo = (ncm || "").replace(/\D/g, "");
  const categoriaIS = NCM_SELETIVOS[ncmLimpo] ?? null;
  const aliqIS = categoriaIS ? IS_ALIQUOTAS[categoriaIS] ?? 0 : 0;

  const cbs2026 = aliquotas?.cbs2026 ?? CBS_ALIQUOTA_2026;
  const ibs2026 = aliquotas?.ibs2026 ?? IBS_ALIQUOTA_2026;
  const cbs2027 = aliquotas?.cbs2027 ?? CBS_ALIQUOTA_2027;
  const ibs2029inicio = aliquotas?.ibs2029inicio ?? IBS_ALIQUOTA_2029_INICIAL;
  const ibs2033 = aliquotas?.ibs2033 ?? IBS_ALIQUOTA_2033;

  switch (modo) {
    case "PRE_REFORMA":
      return {
        cbs: 0, ibs: 0, is: 0,
        extingue_pis_cofins: false, extingue_ipi: false, extingue_icms_iss: false,
        ncm_seletivo: null,
      };

    case "TRANSICAO_2026":
      // CBS 0,9% + IBS 0,1% teste; ainda mantém PIS/COFINS (compensáveis)
      return {
        cbs: +(baseCalculo * cbs2026).toFixed(2),
        ibs: +(baseCalculo * ibs2026).toFixed(2),
        is: 0,
        extingue_pis_cofins: false,
        extingue_ipi: false,
        extingue_icms_iss: false,
        ncm_seletivo: null,
      };

    case "REFORMA_2027":
      // CBS cheia; PIS/COFINS EXTINTOS; IS começa; IPI→0 (exceto ZFM)
      return {
        cbs: +(baseCalculo * cbs2027).toFixed(2),
        ibs: +(baseCalculo * ibs2026).toFixed(2), // IBS ainda teste
        is: +(baseCalculo * aliqIS).toFixed(2),
        extingue_pis_cofins: true,
        extingue_ipi: true,
        extingue_icms_iss: false,
        ncm_seletivo: categoriaIS,
      };

    case "REFORMA_2029": {
      // IBS sobe progressivamente de 2029 até 2032, indo do valor
      // inicial até próximo da alíquota cheia, atingida de fato em 2033.
      // Escalonamento linear em 4 passos (2029, 2030, 2031, 2032).
      const anoValido = ano ?? 2029;
      const anoOffset = Math.max(0, Math.min(3, anoValido - 2029));
      const aliqIBS = ibs2029inicio + anoOffset * ((ibs2033 - ibs2029inicio) / 4);
      return {
        cbs: +(baseCalculo * cbs2027).toFixed(2),
        ibs: +(baseCalculo * aliqIBS).toFixed(2),
        is: +(baseCalculo * aliqIS).toFixed(2),
        extingue_pis_cofins: true,
        extingue_ipi: true,
        extingue_icms_iss: false,
        ncm_seletivo: categoriaIS,
      };
    }

    case "REFORMA_2033":
      // IBS a alíquota cheia; ICMS e ISS extintos
      return {
        cbs: +(baseCalculo * cbs2027).toFixed(2),
        ibs: +(baseCalculo * ibs2033).toFixed(2),
        is: +(baseCalculo * aliqIS).toFixed(2),
        extingue_pis_cofins: true,
        extingue_ipi: true,
        extingue_icms_iss: true,
        ncm_seletivo: categoriaIS,
      };
  }
}

/**
 * Consolida os impostos da reforma para o total de uma nota
 * (somando item a item, essencial para IS que depende do NCM).
 */
export function calcularImpostosNotaReforma(
  itens: Array<{ vprod: number; ncm: string }>,
  dataEmissao: string,
  aliquotas?: AliquotasReformaVigentes
): { cbs: number; ibs: number; is: number; modo: ModoReforma; total_seletivos: number } {
  const modo = modoReformaParaData(dataEmissao);
  const ano = parseInt(dataEmissao.substring(0, 4), 10);
  let cbs = 0, ibs = 0, is = 0, total_seletivos = 0;
  for (const it of itens) {
    const imp = calcularImpostosReforma(it.vprod, it.ncm, modo, ano, aliquotas);
    cbs += imp.cbs;
    ibs += imp.ibs;
    is += imp.is;
    if (imp.ncm_seletivo) total_seletivos += it.vprod;
  }
  return {
    cbs: +cbs.toFixed(2),
    ibs: +ibs.toFixed(2),
    is: +is.toFixed(2),
    total_seletivos: +total_seletivos.toFixed(2),
    modo,
  };
}
