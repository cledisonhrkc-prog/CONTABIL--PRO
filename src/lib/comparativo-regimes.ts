// Comparativo de regimes tributários — DETERMINÍSTICO, sem chute.
// Base: LC 123/2006 (Simples), Lei 9.249/1995 (Presumido), Lei 8.981/1995 (Real),
//       LC 214/2025 (Reforma Tributária).

import { aliquotaEfetivaSimples } from "./simples";

export type RegimeCalc = {
  regime: "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL" | "REFORMA_2027" | "REFORMA_2033";
  nome: string;
  faturamento_anual: number;
  aliquota_efetiva: number;
  imposto_anual: number;
  detalhes: string[];
  observacoes: string[];
  incompatibilidades: string[];
  fonte_legal: string;
};

// Presunção do lucro por atividade (Lei 9.249/1995 art. 15)
const PRESUNCAO_IRPJ_LUCRO: Record<string, { presuncao: number; obs: string }> = {
  COMERCIO: { presuncao: 0.08, obs: "Comércio, indústria, transporte carga: presunção 8%" },
  SERVICO: { presuncao: 0.32, obs: "Serviços em geral: presunção 32%" },
  SERVICO_HOSPITALAR: { presuncao: 0.08, obs: "Serviço hospitalar: 8%" },
  REVENDA_COMBUSTIVEL: { presuncao: 0.016, obs: "Revenda combustível: 1,6%" },
};
const PRESUNCAO_CSLL_LUCRO: Record<string, number> = {
  COMERCIO: 0.12,
  SERVICO: 0.32,
  SERVICO_HOSPITALAR: 0.12,
  REVENDA_COMBUSTIVEL: 0.12,
};

export type ComparativoInput = {
  faturamento_periodo: number; // do lote observado
  meses_periodo: number; // quantos meses o lote cobre
  segmento?: string; // COMERCIO, SERVICO, etc.
  anexo_simples?: string; // I, II, III, IV, V
  margem_operacional?: number; // lucro/receita, para Lucro Real
  regime_atual: string;
};

export function compararRegimes(input: ComparativoInput): RegimeCalc[] {
  const segmento = input.segmento ?? "COMERCIO";
  const anexo = input.anexo_simples ?? "I";
  const meses = Math.max(1, input.meses_periodo);
  const rbt12 = (input.faturamento_periodo / meses) * 12;
  const faturamentoAnual = rbt12; // proxy anual

  const resultados: RegimeCalc[] = [];

  // ==================== SIMPLES NACIONAL ====================
  const simples: RegimeCalc = {
    regime: "SIMPLES",
    nome: "Simples Nacional",
    faturamento_anual: faturamentoAnual,
    aliquota_efetiva: 0,
    imposto_anual: 0,
    detalhes: [],
    observacoes: [],
    incompatibilidades: [],
    fonte_legal: "LC 123/2006",
  };
  if (rbt12 <= 4800000) {
    const aliq = aliquotaEfetivaSimples(rbt12, anexo);
    simples.aliquota_efetiva = aliq;
    simples.imposto_anual = faturamentoAnual * aliq;
    simples.detalhes = [
      `RBT12 estimado: R$ ${fmt(rbt12)}`,
      `Anexo ${anexo}`,
      `Alíquota efetiva: ${(aliq * 100).toFixed(4)}%`,
      `DAS anual estimado: R$ ${fmt(simples.imposto_anual)}`,
    ];
  } else {
    simples.incompatibilidades.push(
      `Faturamento anual (R$ ${fmt(rbt12)}) EXCEDE o teto do Simples (R$ 4.800.000). Regime INDISPONÍVEL.`
    );
    simples.aliquota_efetiva = 0;
    simples.imposto_anual = -1; // sinaliza indisponível
  }
  resultados.push(simples);

  // ==================== LUCRO PRESUMIDO ====================
  const presumido: RegimeCalc = {
    regime: "LUCRO_PRESUMIDO",
    nome: "Lucro Presumido",
    faturamento_anual: faturamentoAnual,
    aliquota_efetiva: 0,
    imposto_anual: 0,
    detalhes: [],
    observacoes: [],
    incompatibilidades: [],
    fonte_legal: "Lei 9.249/1995 art. 15 e 20",
  };
  if (faturamentoAnual <= 78000000) {
    const presIR = PRESUNCAO_IRPJ_LUCRO[segmento] ?? PRESUNCAO_IRPJ_LUCRO.COMERCIO;
    const presCSLL = PRESUNCAO_CSLL_LUCRO[segmento] ?? 0.12;
    const baseIRPJ = faturamentoAnual * presIR.presuncao;
    const baseCSLL = faturamentoAnual * presCSLL;
    const irpj = baseIRPJ * 0.15 + Math.max(baseIRPJ - 240000, 0) * 0.1;
    const csll = baseCSLL * 0.09;
    // PIS/COFINS regime cumulativo
    const pis = faturamentoAnual * 0.0065;
    const cofins = faturamentoAnual * 0.03;
    // ICMS varia — média para comércio Brasil ~7-18%. Usa 12% média mercado (não é rigoroso).
    // ATENÇÃO: aqui NÃO chuto o ICMS pra não induzir erro. Considero só federal.
    const federal = irpj + csll + pis + cofins;
    presumido.imposto_anual = federal;
    presumido.aliquota_efetiva = federal / faturamentoAnual;
    presumido.detalhes = [
      `Presunção IRPJ: ${(presIR.presuncao * 100).toFixed(1)}% — ${presIR.obs}`,
      `Presunção CSLL: ${(presCSLL * 100).toFixed(1)}%`,
      `IRPJ + adicional: R$ ${fmt(irpj)}`,
      `CSLL: R$ ${fmt(csll)}`,
      `PIS cumulativo (0,65%): R$ ${fmt(pis)}`,
      `COFINS cumulativo (3%): R$ ${fmt(cofins)}`,
      `TOTAL FEDERAL: R$ ${fmt(federal)}`,
    ];
    presumido.observacoes.push(
      "⚠️ Este cálculo NÃO inclui ICMS (varia 7-18% por UF/produto) nem ISS (2-5%). Some ao total para valor real."
    );
    presumido.observacoes.push(
      "⚠️ Presumido NÃO gera crédito de PIS/COFINS/ICMS. Pode ser mais caro que Real se a empresa tem muitos insumos tributados."
    );
  } else {
    presumido.incompatibilidades.push(
      `Faturamento anual (R$ ${fmt(faturamentoAnual)}) EXCEDE o teto do Presumido (R$ 78.000.000).`
    );
    presumido.imposto_anual = -1;
  }
  resultados.push(presumido);

  // ==================== LUCRO REAL ====================
  const real: RegimeCalc = {
    regime: "LUCRO_REAL",
    nome: "Lucro Real",
    faturamento_anual: faturamentoAnual,
    aliquota_efetiva: 0,
    imposto_anual: 0,
    detalhes: [],
    observacoes: [],
    incompatibilidades: [],
    fonte_legal: "Lei 8.981/1995, Lei 9.430/1996",
  };
  const margem = input.margem_operacional ?? null;
  if (margem === null) {
    real.observacoes.push(
      "⚠️ Não foi informada a margem operacional real (lucro/receita). Sem esse dado, o cálculo do Lucro Real é IMPOSSÍVEL de estimar com honestidade."
    );
    real.observacoes.push(
      "Regra: Lucro Real cobra IRPJ 15% + adicional 10% sobre lucro anual > 240k, CSLL 9% sobre lucro, PIS 1,65% e COFINS 7,6% NÃO-cumulativos (com créditos)."
    );
    real.imposto_anual = -2; // sinaliza sem dados
  } else {
    const lucro = faturamentoAnual * margem;
    const irpj = lucro * 0.15 + Math.max(lucro - 240000, 0) * 0.1;
    const csll = lucro * 0.09;
    // PIS/COFINS não cumulativos — 9,25% sobre saída, com crédito de entradas.
    // Sem dados de entradas, uso 0 de crédito (pior cenário).
    const pisNC = faturamentoAnual * 0.0165;
    const cofinsNC = faturamentoAnual * 0.076;
    const federal = irpj + csll + pisNC + cofinsNC;
    real.imposto_anual = federal;
    real.aliquota_efetiva = federal / faturamentoAnual;
    real.detalhes = [
      `Margem operacional informada: ${(margem * 100).toFixed(1)}%`,
      `Lucro real estimado: R$ ${fmt(lucro)}`,
      `IRPJ + adicional: R$ ${fmt(irpj)}`,
      `CSLL: R$ ${fmt(csll)}`,
      `PIS não-cumulativo (1,65%): R$ ${fmt(pisNC)}`,
      `COFINS não-cumulativo (7,6%): R$ ${fmt(cofinsNC)}`,
      `TOTAL FEDERAL (sem crédito): R$ ${fmt(federal)}`,
    ];
    real.observacoes.push(
      "⚠️ Cálculo SEM créditos de PIS/COFINS. Se a empresa tem muitas entradas tributadas, o imposto real cai significativamente."
    );
    real.observacoes.push("⚠️ Não inclui ICMS (varia por UF) nem ISS.");
  }
  resultados.push(real);

  // ==================== REFORMA 2027 (CBS + PIS/COFINS extintos + IPI zero) ====================
  const reforma27: RegimeCalc = {
    regime: "REFORMA_2027",
    nome: "Reforma Tributária 2027 (parcial)",
    faturamento_anual: faturamentoAnual,
    aliquota_efetiva: 0,
    imposto_anual: 0,
    detalhes: [],
    observacoes: [],
    incompatibilidades: [],
    fonte_legal: "EC 132/2023, LC 214/2025 (regulamentação em curso)",
  };
  // Em 2027: CBS 8,8% (referência do MF) substitui PIS/COFINS. IPI zerado (exceto ZFM).
  // ICMS e ISS ainda existem no valor pleno. Sem estimar ICMS aqui pra não induzir erro.
  const cbs27 = faturamentoAnual * 0.088;
  reforma27.imposto_anual = cbs27; // só a parte federal nova
  reforma27.aliquota_efetiva = 0.088;
  reforma27.detalhes = [
    `CBS (Contribuição sobre Bens e Serviços): 8,8% de referência`,
    `CBS estimada anual: R$ ${fmt(cbs27)}`,
    `PIS + COFINS extintos (economia estimada dessas 2 contribuições)`,
    `IPI zerado (exceto Zona Franca de Manaus)`,
  ];
  reforma27.observacoes.push(
    "🚨 ATENÇÃO: em 2027 SÓ MUDA O FEDERAL. ICMS e ISS continuam no valor pleno até 2033."
  );
  reforma27.observacoes.push(
    "⚠️ Alíquota CBS de 8,8% é REFERÊNCIA do Ministério da Fazenda — pode ser ajustada por lei anual."
  );
  reforma27.observacoes.push(
    "⚠️ Este número NÃO É COMPARÁVEL diretamente com Simples/Presumido/Real (que já incluem ICMS)."
  );
  reforma27.observacoes.push(
    "❌ NÃO USE este número isolado para decisão de regime — ele mede APENAS a substituição PIS+COFINS → CBS."
  );
  resultados.push(reforma27);

  // ==================== REFORMA 2033 (regime pleno) ====================
  const reforma33: RegimeCalc = {
    regime: "REFORMA_2033",
    nome: "Reforma Tributária 2033 (regime pleno)",
    faturamento_anual: faturamentoAnual,
    aliquota_efetiva: 0,
    imposto_anual: 0,
    detalhes: [],
    observacoes: [],
    incompatibilidades: [],
    fonte_legal: "EC 132/2023, LC 214/2025",
  };
  const cbs33 = faturamentoAnual * 0.088;
  const ibs33 = faturamentoAnual * 0.177; // referência MF ~17,7%
  const totalReforma33 = cbs33 + ibs33;
  reforma33.imposto_anual = totalReforma33;
  reforma33.aliquota_efetiva = totalReforma33 / faturamentoAnual;
  reforma33.detalhes = [
    `CBS 8,8% (federal): R$ ${fmt(cbs33)}`,
    `IBS 17,7% (estadual+municipal, substitui ICMS+ISS): R$ ${fmt(ibs33)}`,
    `TOTAL CBS+IBS: R$ ${fmt(totalReforma33)}`,
    `Alíquota consolidada: ${(reforma33.aliquota_efetiva * 100).toFixed(2)}%`,
  ];
  reforma33.observacoes.push(
    "🚨 Alíquota conjunta ~26,5% é MAIS ALTA que Simples (~6-15%) para pequenas empresas."
  );
  reforma33.observacoes.push(
    "✅ Vantagem da Reforma: crédito integral de todas as entradas (fim do efeito cascata)."
  );
  reforma33.observacoes.push(
    "✅ Reforma FAVORECE empresas com MUITOS insumos tributados. Prejudica empresas de serviço/varejo puro."
  );
  reforma33.observacoes.push(
    "⚠️ Simples Nacional continua existindo no regime pleno (empresa pode ficar no Simples se preferir)."
  );
  resultados.push(reforma33);

  return resultados;
}

export function melhorRegime(rs: RegimeCalc[]): RegimeCalc | null {
  const validos = rs.filter((r) => r.imposto_anual >= 0 && r.incompatibilidades.length === 0);
  if (validos.length === 0) return null;
  return validos.reduce((min, r) => (r.imposto_anual < min.imposto_anual ? r : min));
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


