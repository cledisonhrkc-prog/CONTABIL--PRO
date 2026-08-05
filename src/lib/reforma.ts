// =============================================================================
// REFORMA TRIBUTÁRIA — EC 132/2023 + LC 214/2025
// Cronograma oficial de implementação:
//   2026: CBS 0,9% e IBS 0,1% (teste, compensáveis com PIS/COFINS)
//   2027: CBS a alíquota cheia (~8,8%) SUBSTITUI PIS/COFINS (extintos)
//         IPI → zero para maioria (exceto ZFM)
//         Imposto Seletivo (IS) começa a ser cobrado
//   2029-2032: IBS gradual, ICMS/ISS decrescentes
//   2033: IBS a alíquota cheia (~17,7%), ICMS e ISS extintos
// =============================================================================

// Alíquotas de referência publicadas pelo Ministério da Fazenda em 2025
// (podem sofrer ajuste anual pela LDO, mas são as vigentes hoje)
export const CBS_ALIQUOTA_2026 = 0.009; // 0,9% teste
export const IBS_ALIQUOTA_2026 = 0.001; // 0,1% teste
export const CBS_ALIQUOTA_2027 = 0.088; // 8,8% - alíquota cheia federal
export const IBS_ALIQUOTA_2029_INICIAL = 0.001; // começa muito pequena, sobe até 17,7% em 2033

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

/**
 * Calcula impostos da Reforma Tributária para um item.
 * @param baseCalculo valor do produto/serviço
 * @param ncm NCM do produto (para IS)
 * @param modo modo da reforma
 */
export function calcularImpostosReforma(
  baseCalculo: number,
  ncm: string,
  modo: ModoReforma
): ImpostosReforma {
  const ncmLimpo = (ncm || "").replace(/\D/g, "");
  const categoriaIS = NCM_SELETIVOS[ncmLimpo] ?? null;
  const aliqIS = categoriaIS ? IS_ALIQUOTAS[categoriaIS] ?? 0 : 0;

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
        cbs: +(baseCalculo * CBS_ALIQUOTA_2026).toFixed(2),
        ibs: +(baseCalculo * IBS_ALIQUOTA_2026).toFixed(2),
        is: 0,
        extingue_pis_cofins: false,
        extingue_ipi: false,
        extingue_icms_iss: false,
        ncm_seletivo: null,
      };

    case "REFORMA_2027":
      // CBS cheia; PIS/COFINS EXTINTOS; IS começa; IPI→0 (exceto ZFM)
      return {
        cbs: +(baseCalculo * CBS_ALIQUOTA_2027).toFixed(2),
        ibs: +(baseCalculo * IBS_ALIQUOTA_2026).toFixed(2), // IBS ainda teste
        is: +(baseCalculo * aliqIS).toFixed(2),
        extingue_pis_cofins: true,
        extingue_ipi: true,
        extingue_icms_iss: false,
        ncm_seletivo: categoriaIS,
      };

    case "REFORMA_2029": {
      // IBS começa a subir; ICMS/ISS decrescem
      const anoOffset = 0; // aqui poderia usar (ano - 2029) para escalonar
      const aliqIBS = 0.001 + anoOffset * 0.044;
      return {
        cbs: +(baseCalculo * CBS_ALIQUOTA_2027).toFixed(2),
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
        cbs: +(baseCalculo * CBS_ALIQUOTA_2027).toFixed(2),
        ibs: +(baseCalculo * 0.177).toFixed(2), // 17,7% referência
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
  dataEmissao: string
): { cbs: number; ibs: number; is: number; modo: ModoReforma; total_seletivos: number } {
  const modo = modoReformaParaData(dataEmissao);
  let cbs = 0, ibs = 0, is = 0, total_seletivos = 0;
  for (const it of itens) {
    const imp = calcularImpostosReforma(it.vprod, it.ncm, modo);
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
