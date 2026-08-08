// Pré-validação de NF-e ANTES da contabilização
// Gera dossiê estruturado com dados CRUS pra IA analisar antes do sistema processar.
// Objetivo: IA ver os problemas ANTES de serem "digeridos" pelo motor.

import type { NF } from "./nfe-parser";

export type PreValidacaoAlerta = {
  severidade: "ERRO" | "AVISO" | "INFO";
  categoria: string;
  nota: string;
  descricao: string;
  campo?: string;
  valor?: string | number;
};

export type PreValidacaoResumo = {
  gerado_em: string;
  total_xmls_recebidos: number;

  // Contagens crus
  por_status: Record<string, number>; // cStat=100, 101, 110, etc
  por_tipo_operacao: Record<string, number>;
  por_finalidade: Record<string, number>;
  por_modelo: Record<string, number>;
  por_serie: Record<string, number>;
  por_mes: Record<string, number>;
  por_participante_top: Array<{ nome: string; cnpj: string; qtd: number; total: number }>;

  // Chaves duplicadas
  duplicatas_por_chave: Array<{ chave: string; qtd: number }>;

  // Somatórios financeiros ANTES de qualquer filtro
  totais_brutos: {
    valor_nf_total: number;
    valor_produtos: number;
    valor_icms: number;
    valor_icms_st: number;
    valor_ipi: number;
    valor_pis: number;
    valor_cofins: number;
    valor_iss: number;
    valor_desconto: number;
    valor_frete: number;
  };

  // Somatórios DEPOIS de aplicar filtros (canceladas fora, dedup)
  totais_filtrados: {
    qtd_notas_validas: number;
    faturamento_liquido_st: number;
    faturamento_bruto_nf: number;
    valor_produtos: number;
  };

  // Análise por CFOP
  cfop_analise: Array<{
    cfop: string;
    descricao_provavel: string;
    qtd_itens: number;
    qtd_notas: number;
    valor_total_itens: number;
    operacao: string;
  }>;

  // NCMs / itens com CST monofásico questionável
  ncm_analise: Array<{
    ncm: string;
    descricao_produto_exemplo: string;
    qtd_itens: number;
    valor_total: number;
    csts_pis_encontrados: string[];
    csts_cofins_encontrados: string[];
    monofasico_suspeito: boolean;
  }>;

  // Alertas de problemas detectados
  alertas: PreValidacaoAlerta[];

  // Amostra de 5 NFs completas (pra IA ver o formato cru parseado)
  amostra_nfs: NF[];

  // Amostra de XMLs BRUTOS (raw) — pra IA ver os campos originais como vieram do SEFAZ
  amostra_xmls_crus: Array<{ nome: string; xml: string; chave: string }>;
};

// NCMs de produtos monofásicos (mesmo conjunto do contabilizador)
const NCM_MONOFASICO_PISCOFINS = new Set([
  "22021000", "22029900",
  "30049099", "30049029", "30049024", "30049037", "30049039",
  "30049043", "30049059", "30049069", "30049079",
  "30044200", "30043290", "30043999", "30042099",
  "15179090", "90278999",
  "33059000", "33071000", "82121020",
  "24022000", "27101259",
]);

// Descrição amigável dos CFOPs mais comuns
const CFOP_DESC: Record<string, string> = {
  "5101": "Venda de produção do estabelecimento",
  "5102": "Venda de mercadoria adquirida ou recebida de terceiros",
  "5405": "Venda de mercadoria adquirida ou recebida de terceiros em operação com ST",
  "5403": "Venda de mercadoria adquirida ou recebida de terceiros em operação com ST (substituto)",
  "5104": "Venda de mercadoria adquirida ou recebida de terceiros pela cooperativa",
  "5109": "Venda de produção do estabelecimento ao exterior",
  "5202": "Devolução de compra para comercialização",
  "5910": "Remessa em bonificação, doação ou brinde",
  "5911": "Remessa de amostra grátis",
  "5915": "Remessa para conserto ou reparo",
  "5949": "Outra saída de mercadoria ou prestação de serviço não especificado",
  "6102": "Venda interestadual de mercadoria adquirida ou recebida de terceiros",
  "6108": "Venda interestadual para não contribuinte",
  "6404": "Venda de mercadoria interestadual com ST",
  "1101": "Compra para industrialização",
  "1102": "Compra para comercialização",
  "1202": "Devolução de venda de mercadoria",
  "1403": "Compra para comercialização em operação com ST",
  "2102": "Compra interestadual para comercialização",
  "2202": "Devolução interestadual de venda",
  "2403": "Compra interestadual para comercialização com ST",
};

// Descrição do cStat da SEFAZ (principais)
const CSTAT_DESC: Record<string, string> = {
  "100": "Autorizado o uso da NF-e",
  "101": "Cancelamento da NF-e homologado",
  "102": "Inutilização de número homologada",
  "110": "Uso Denegado",
  "150": "Autorizado o uso da NF-e fora de prazo",
  "205": "NF-e está denegada na base de dados da SEFAZ",
  "301": "Uso denegado: Irregularidade fiscal do emitente",
  "302": "Uso denegado: Irregularidade fiscal do destinatário",
};

export function preValidar(
  nfs: NF[],
  xmlsCrus: Array<{ nome: string; xml: string; chave: string }> = []
): PreValidacaoResumo {
  const alertas: PreValidacaoAlerta[] = [];
  const por_status: Record<string, number> = {};
  const por_tipo_operacao: Record<string, number> = {};
  const por_finalidade: Record<string, number> = {};
  const por_modelo: Record<string, number> = {};
  const por_serie: Record<string, number> = {};
  const por_mes: Record<string, number> = {};

  // Contagem de chaves
  const chavesCount: Record<string, number> = {};
  for (const nf of nfs) {
    const k = (nf.chave || "").trim() || `${nf.numero}|${nf.serie}|${nf.valor_total}`;
    chavesCount[k] = (chavesCount[k] ?? 0) + 1;
  }
  const duplicatas_por_chave = Object.entries(chavesCount)
    .filter(([, q]) => q > 1)
    .map(([chave, qtd]) => ({ chave, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 20);

  // Participantes
  const partMap = new Map<string, { nome: string; cnpj: string; qtd: number; total: number }>();

  // Totais brutos
  const tb = {
    valor_nf_total: 0, valor_produtos: 0, valor_icms: 0, valor_icms_st: 0,
    valor_ipi: 0, valor_pis: 0, valor_cofins: 0, valor_iss: 0,
    valor_desconto: 0, valor_frete: 0,
  };

  // Filtrados (só cStat 100/150 e sem duplicatas)
  const chavesVistas = new Set<string>();
  const tf = {
    qtd_notas_validas: 0,
    faturamento_liquido_st: 0,
    faturamento_bruto_nf: 0,
    valor_produtos: 0,
  };

  // CFOP e NCM
  type CFOPAgg = { qtd_itens: number; notas: Set<string>; valor_total_itens: number; operacao: string };
  const cfopMap = new Map<string, CFOPAgg>();
  type NCMAgg = { descricao: string; qtd_itens: number; valor_total: number; cstsPis: Set<string>; cstsCof: Set<string> };
  const ncmMap = new Map<string, NCMAgg>();

  for (const nf of nfs) {
    // cStat
    const cs = String(nf.cStat ?? "100");
    por_status[cs] = (por_status[cs] ?? 0) + 1;
    // Tipo/finalidade/modelo/serie
    por_tipo_operacao[nf.tipo_operacao] = (por_tipo_operacao[nf.tipo_operacao] ?? 0) + 1;
    por_finalidade[nf.finalidade] = (por_finalidade[nf.finalidade] ?? 0) + 1;
    por_modelo[nf.modelo || "?"] = (por_modelo[nf.modelo || "?"] ?? 0) + 1;
    por_serie[nf.serie || "?"] = (por_serie[nf.serie || "?"] ?? 0) + 1;
    // Mês
    const mes = (nf.data_emissao || "").substring(0, 7);
    if (mes) por_mes[mes] = (por_mes[mes] ?? 0) + 1;

    // Participantes
    const chavePart = nf.cnpj_part || nf.participante || "?";
    const p = partMap.get(chavePart) ?? { nome: nf.participante || "?", cnpj: nf.cnpj_part || "", qtd: 0, total: 0 };
    p.qtd++;
    p.total += nf.valor_total;
    partMap.set(chavePart, p);

    // Totais brutos (SEM filtro)
    tb.valor_nf_total += nf.valor_total;
    tb.valor_produtos += nf.valor_produtos;
    tb.valor_icms += nf.valor_icms;
    tb.valor_icms_st += nf.valor_icms_st;
    tb.valor_ipi += nf.valor_ipi;
    tb.valor_pis += nf.valor_pis;
    tb.valor_cofins += nf.valor_cofins;
    tb.valor_iss += nf.valor_iss;
    tb.valor_desconto += nf.valor_desconto;
    tb.valor_frete += nf.valor_frete;

    // Filtro: só cStat 100/150 + dedup
    const ehValida = cs === "100" || cs === "150";
    const chaveNF = (nf.chave || "").trim() || `${nf.numero}|${nf.serie}|${nf.valor_total}`;
    const ehUnica = !chavesVistas.has(chaveNF);
    if (ehValida && ehUnica) {
      chavesVistas.add(chaveNF);
      tf.qtd_notas_validas++;
      if (nf.tipo_operacao === "SAIDA" && (nf.finalidade === "VENDA" || nf.finalidade === "SERVICO")) {
        tf.faturamento_liquido_st += nf.valor_total - nf.valor_icms_st;
        tf.faturamento_bruto_nf += nf.valor_total;
        tf.valor_produtos += nf.valor_produtos;
      }
    }

    // Itens: CFOP e NCM
    for (const it of nf.itens) {
      const cfop = (it.cfop || "SEM_CFOP").trim();
      const agg = cfopMap.get(cfop) ?? { qtd_itens: 0, notas: new Set(), valor_total_itens: 0, operacao: nf.tipo_operacao };
      agg.qtd_itens++;
      agg.notas.add(chaveNF);
      agg.valor_total_itens += it.vprod;
      cfopMap.set(cfop, agg);

      const ncm = (it.ncm || "").replace(/\D/g, "");
      if (ncm) {
        const na = ncmMap.get(ncm) ?? {
          descricao: it.xprod, qtd_itens: 0, valor_total: 0,
          cstsPis: new Set(), cstsCof: new Set(),
        };
        na.qtd_itens++;
        na.valor_total += it.vprod;
        if (it.cst_pis) na.cstsPis.add(it.cst_pis.padStart(2, "0"));
        if (it.cst_cof) na.cstsCof.add(it.cst_cof.padStart(2, "0"));
        ncmMap.set(ncm, na);
      }
    }

    // Alertas
    if (cs !== "100" && cs !== "150") {
      alertas.push({
        severidade: "AVISO",
        categoria: "Status SEFAZ",
        nota: `NF ${nf.numero}/${nf.serie}`,
        descricao: `cStat=${cs} (${CSTAT_DESC[cs] ?? "outro"}). Será EXCLUÍDA da contabilização.`,
        campo: "cStat",
        valor: cs,
      });
    }
    if (nf.valor_total <= 0) {
      alertas.push({
        severidade: "ERRO",
        categoria: "Valor",
        nota: `NF ${nf.numero}`,
        descricao: "Valor total zero ou negativo",
        campo: "valor_total", valor: nf.valor_total,
      });
    }
    if (!nf.data_emissao || nf.data_emissao === "2024-01-01") {
      alertas.push({
        severidade: "AVISO",
        categoria: "Data",
        nota: `NF ${nf.numero}`,
        descricao: "Data de emissão faltando ou default. Verificar dhEmi/dEmi no XML.",
        campo: "data_emissao", valor: nf.data_emissao,
      });
    }
    // Itens sem NCM
    for (const it of nf.itens) {
      if (!it.ncm) {
        alertas.push({
          severidade: "AVISO",
          categoria: "NCM",
          nota: `NF ${nf.numero}`,
          descricao: `Item "${it.xprod?.substring(0, 40)}" sem NCM`,
        });
        break;
      }
    }
  }

  // Alertas de dedup
  if (duplicatas_por_chave.length > 0) {
    const totalDup = duplicatas_por_chave.reduce((a, r) => a + (r.qtd - 1), 0);
    alertas.push({
      severidade: "AVISO",
      categoria: "Deduplicação",
      nota: "Lote inteiro",
      descricao: `${duplicatas_por_chave.length} chave(s) duplicada(s) totalizando ${totalDup} XMLs redundantes (SEFAZ manda autorização + eventos). Serão descartadas.`,
    });
  }

  // Alertas monofásico
  const ncmSuspeitos: string[] = [];
  for (const [ncm, agg] of ncmMap.entries()) {
    const mono = NCM_MONOFASICO_PISCOFINS.has(ncm);
    if (mono) {
      const cstsErrados = [...agg.cstsPis, ...agg.cstsCof].filter((c) => c === "01" || c === "02");
      if (cstsErrados.length > 0) {
        ncmSuspeitos.push(ncm);
        alertas.push({
          severidade: "ERRO",
          categoria: "R08 Monofásico",
          nota: `NCM ${ncm}`,
          descricao: `Produto "${agg.descricao.substring(0, 40)}" é MONOFÁSICO PIS/COFINS mas está com CST=01/02 (tributado normal). Deveria ser CST=04. Impede recuperação de crédito.`,
        });
      }
    }
  }

  // Top participantes
  const por_participante_top = Array.from(partMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // CFOP analysis
  const cfop_analise = Array.from(cfopMap.entries())
    .map(([cfop, agg]) => ({
      cfop,
      descricao_provavel: CFOP_DESC[cfop] ?? "CFOP não catalogado",
      qtd_itens: agg.qtd_itens,
      qtd_notas: agg.notas.size,
      valor_total_itens: Number(agg.valor_total_itens.toFixed(2)),
      operacao: agg.operacao,
    }))
    .sort((a, b) => b.valor_total_itens - a.valor_total_itens);

  // NCM analysis
  const ncm_analise = Array.from(ncmMap.entries())
    .map(([ncm, agg]) => ({
      ncm,
      descricao_produto_exemplo: agg.descricao,
      qtd_itens: agg.qtd_itens,
      valor_total: Number(agg.valor_total.toFixed(2)),
      csts_pis_encontrados: Array.from(agg.cstsPis).sort(),
      csts_cofins_encontrados: Array.from(agg.cstsCof).sort(),
      monofasico_suspeito: ncmSuspeitos.includes(ncm),
    }))
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 30);

  // Amostra: 5 NFs (a maior, a menor, e 3 aleatórias)
  const ordenadas = [...nfs].sort((a, b) => b.valor_total - a.valor_total);
  const amostra_nfs: NF[] = [];
  if (ordenadas[0]) amostra_nfs.push(ordenadas[0]);
  if (ordenadas.length > 1 && ordenadas[ordenadas.length - 1]) amostra_nfs.push(ordenadas[ordenadas.length - 1]);
  const passo = Math.max(1, Math.floor(ordenadas.length / 4));
  for (let i = passo; i < ordenadas.length - passo && amostra_nfs.length < 5; i += passo) {
    amostra_nfs.push(ordenadas[i]);
  }

  // Arredonda totais
  Object.keys(tb).forEach((k) => {
    (tb as Record<string, number>)[k] = Number((tb as Record<string, number>)[k].toFixed(2));
  });
  Object.keys(tf).forEach((k) => {
    (tf as Record<string, number>)[k] = Number((tf as Record<string, number>)[k].toFixed(2));
  });

  return {
    gerado_em: new Date().toISOString(),
    total_xmls_recebidos: nfs.length,
    por_status,
    por_tipo_operacao,
    por_finalidade,
    por_modelo,
    por_serie,
    por_mes,
    por_participante_top,
    duplicatas_por_chave,
    totais_brutos: tb,
    totais_filtrados: tf,
    cfop_analise,
    ncm_analise,
    alertas,
    amostra_nfs,
    amostra_xmls_crus: xmlsCrus.slice(0, 10),
  };
}

// Formata como texto Markdown para IA
export function formatarPreValidacaoTexto(pv: PreValidacaoResumo): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const l: string[] = [];
  l.push("# DOSSIÊ DE PRÉ-VALIDAÇÃO DE NF-e");
  l.push(`Gerado em: ${new Date(pv.gerado_em).toLocaleString("pt-BR")}`);
  l.push(`Sistema: SIGC Contábil Pro — camada de VALIDAÇÃO ANTES da contabilização`);
  l.push("");
  l.push("## OBJETIVO DESTE DOSSIÊ");
  l.push("Você (IA) está recebendo os dados EXATAMENTE como saíram do parse dos XMLs, ANTES do sistema contabilizar. Sua missão é DETECTAR problemas que se perderiam depois da agregação: chaves duplicadas, cStat inválido, NCMs suspeitos, CFOPs incompatíveis, valores absurdos, datas fora do período, etc.");
  l.push("");
  l.push("## 1. RESUMO CRU (sem filtros)");
  l.push(`- Total de XMLs recebidos: **${pv.total_xmls_recebidos}**`);
  l.push(`- Total de notas ÚNICAS válidas (cStat=100/150, sem dupes): **${pv.totais_filtrados.qtd_notas_validas}**`);
  l.push(`- Perda por cStat/dedup: **${pv.total_xmls_recebidos - pv.totais_filtrados.qtd_notas_validas}** XMLs`);
  l.push("");
  l.push("## 2. DISTRIBUIÇÃO POR STATUS SEFAZ (cStat)");
  for (const [k, v] of Object.entries(pv.por_status)) {
    const desc = CSTAT_DESC[k] ?? "desconhecido";
    l.push(`- **cStat ${k}** (${desc}): ${v}`);
  }
  l.push("");
  l.push("## 3. DISTRIBUIÇÃO POR TIPO/FINALIDADE/MODELO");
  l.push(`**Tipo:** ${JSON.stringify(pv.por_tipo_operacao)}`);
  l.push(`**Finalidade:** ${JSON.stringify(pv.por_finalidade)}`);
  l.push(`**Modelo:** ${JSON.stringify(pv.por_modelo)}`);
  l.push(`**Série:** ${JSON.stringify(pv.por_serie)}`);
  l.push("");
  l.push("## 4. DISTRIBUIÇÃO MENSAL");
  for (const [mes, qtd] of Object.entries(pv.por_mes).sort()) {
    l.push(`- ${mes}: ${qtd} notas`);
  }
  l.push("");
  l.push("## 5. TOTAIS FINANCEIROS (BRUTO, todas as NFs)");
  l.push(`| Campo | Valor |`);
  l.push(`|-------|-------|`);
  l.push(`| Valor NF total (vNF) | R$ ${fmt(pv.totais_brutos.valor_nf_total)} |`);
  l.push(`| Valor Produtos (vProd) | R$ ${fmt(pv.totais_brutos.valor_produtos)} |`);
  l.push(`| ICMS | R$ ${fmt(pv.totais_brutos.valor_icms)} |`);
  l.push(`| ICMS-ST | R$ ${fmt(pv.totais_brutos.valor_icms_st)} |`);
  l.push(`| IPI | R$ ${fmt(pv.totais_brutos.valor_ipi)} |`);
  l.push(`| PIS | R$ ${fmt(pv.totais_brutos.valor_pis)} |`);
  l.push(`| COFINS | R$ ${fmt(pv.totais_brutos.valor_cofins)} |`);
  l.push(`| ISS | R$ ${fmt(pv.totais_brutos.valor_iss)} |`);
  l.push(`| Descontos | R$ ${fmt(pv.totais_brutos.valor_desconto)} |`);
  l.push(`| Frete | R$ ${fmt(pv.totais_brutos.valor_frete)} |`);
  l.push("");
  l.push("## 6. TOTAIS FINANCEIROS (FILTRADO — só notas válidas e únicas)");
  l.push(`- Faturamento líquido de ST: **R$ ${fmt(pv.totais_filtrados.faturamento_liquido_st)}**`);
  l.push(`- Faturamento bruto NF: R$ ${fmt(pv.totais_filtrados.faturamento_bruto_nf)}`);
  l.push(`- Valor de produtos: R$ ${fmt(pv.totais_filtrados.valor_produtos)}`);
  l.push("");
  l.push("## 7. DUPLICATAS POR CHAVE (SEFAZ manda 2-3 XMLs por NF)");
  if (pv.duplicatas_por_chave.length === 0) {
    l.push("Nenhuma chave duplicada detectada.");
  } else {
    l.push(`Total de chaves duplicadas: ${pv.duplicatas_por_chave.length}`);
    l.push("Top 10 chaves com mais duplicações:");
    for (const d of pv.duplicatas_por_chave.slice(0, 10)) {
      l.push(`- ${d.chave.substring(0, 44)}...: ${d.qtd} XMLs`);
    }
  }
  l.push("");
  l.push("## 8. ANÁLISE POR CFOP");
  l.push("| CFOP | Op. | Notas | Itens | Valor (itens) | Descrição |");
  l.push("|------|-----|-------|-------|--------------|-----------|");
  for (const c of pv.cfop_analise.slice(0, 20)) {
    l.push(`| ${c.cfop} | ${c.operacao} | ${c.qtd_notas} | ${c.qtd_itens} | R$ ${fmt(c.valor_total_itens)} | ${c.descricao_provavel} |`);
  }
  l.push("");
  l.push("## 9. ANÁLISE POR NCM (top 20 por valor)");
  l.push("| NCM | Produto exemplo | Itens | Valor | CST PIS | CST COFINS | Suspeito? |");
  l.push("|-----|-----------------|-------|-------|---------|-----------|-----------|");
  for (const n of pv.ncm_analise.slice(0, 20)) {
    const susp = n.monofasico_suspeito ? "🚨 MONOFÁSICO" : "";
    l.push(`| ${n.ncm} | ${n.descricao_produto_exemplo.substring(0, 30)} | ${n.qtd_itens} | R$ ${fmt(n.valor_total)} | ${n.csts_pis_encontrados.join(",")} | ${n.csts_cofins_encontrados.join(",")} | ${susp} |`);
  }
  l.push("");
  l.push("## 10. TOP 20 PARTICIPANTES (cliente/fornecedor)");
  for (const p of pv.por_participante_top) {
    l.push(`- ${p.nome} (CNPJ ${p.cnpj || "-"}): ${p.qtd} NFs, R$ ${fmt(p.total)}`);
  }
  l.push("");
  l.push("## 11. ALERTAS DETECTADOS AUTOMATICAMENTE");
  if (pv.alertas.length === 0) {
    l.push("✅ Nenhum alerta");
  } else {
    const porSeveridade: Record<string, PreValidacaoAlerta[]> = { ERRO: [], AVISO: [], INFO: [] };
    for (const a of pv.alertas) porSeveridade[a.severidade].push(a);
    for (const sev of ["ERRO", "AVISO", "INFO"]) {
      const lista = porSeveridade[sev];
      if (lista.length === 0) continue;
      l.push(`### ${sev} (${lista.length})`);
      for (const a of lista.slice(0, 30)) {
        l.push(`- [${a.categoria}] ${a.nota}: ${a.descricao}`);
      }
      if (lista.length > 30) l.push(`- ... e mais ${lista.length - 30} ${sev.toLowerCase()}(s)`);
    }
  }
  l.push("");
  l.push("## 12. AMOSTRA DE 5 NF-e COMPLETAS (parsed JSON)");
  l.push("```json");
  l.push(JSON.stringify(pv.amostra_nfs, null, 2));
  l.push("```");
  l.push("");
  l.push("## 13. AMOSTRA DE XMLs BRUTOS (raw SEFAZ — para verificação de campos originais)");
  l.push(`Total de amostras: ${pv.amostra_xmls_crus.length} XMLs (limitados a 10 KB cada, primeiros ${pv.amostra_xmls_crus.length} do lote)`);
  l.push("");
  for (let i = 0; i < pv.amostra_xmls_crus.length; i++) {
    const s = pv.amostra_xmls_crus[i];
    l.push(`### XML ${i + 1}: ${s.nome} (chave: ${s.chave || "-"})`);
    l.push("```xml");
    l.push(s.xml);
    l.push("```");
    l.push("");
  }
  l.push("---");
  l.push("## PERGUNTAS PARA A IA");
  l.push("");
  l.push("Analise este dossiê ANTES da contabilização e responda:");
  l.push("");
  l.push("1. **Riscos fiscais**: Você identificou algum problema estrutural nas notas antes que o sistema contabilize? (CSTs errados, CFOPs incompatíveis com a atividade, NCMs mal classificados)");
  l.push("");
  l.push("2. **Integridade dos dados**: Os totais bruto vs filtrado fazem sentido? A perda por dedup/cStat está dentro do razoável (5-15% para PDV/farmácia)?");
  l.push("");
  l.push("3. **Concentração de risco**: Existem participantes ou NCMs que concentram valor demais? Algum CFOP suspeito (ex: 5910/5911 bonificação em volume alto)?");
  l.push("");
  l.push("4. **Recomendação de PROSSEGUIR ou PARAR**: Baseado nos alertas, você recomenda que o sistema PROSSIGA com a contabilização, ou tem algo que precisa ser resolvido ANTES?");
  l.push("");
  l.push("5. **Auditoria monofásico**: Confirmar se os NCMs marcados como suspeitos realmente estão com CST errado — quanto de crédito PIS/COFINS pode ser recuperado?");
  return l.join("\n");
}
