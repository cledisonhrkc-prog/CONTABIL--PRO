// Gera um "dossiê" completo dos dados contábeis-fiscais formatado
// para colar em qualquer IA (ChatGPT, Claude, Gemini, Grok, etc.)

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getEmpresaAtiva } from "./empresa";
import {
  balanco,
  apuracao,
  auditoriaR08,
  dashboardResumo,
  topDespesas,
  fluxoCaixaMensal,
  dre,
} from "./relatorios";
import { comparativoAntesDepois } from "./reforma-relatorios";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type DossieIA = {
  gerado_em: string;
  empresa: {
    nome: string;
    cnpj: string;
    regime: string;
    anexo_simples: string | null;
    rbt12: number;
  };
  periodo: {
    data_inicio: string | null;
    data_fim: string | null;
    dias: number;
  };
  resumo: {
    qtd_notas: number;
    qtd_notas_saida: number;
    qtd_notas_entrada: number;
    qtd_notas_servico: number;
    faturamento_saidas: number;
    total_compras: number;
    total_impostos_a_pagar: number;
    saldo_bancos: number;
    contas_a_receber: number;
    contas_a_pagar: number;
  };
  balanco: {
    ativo: number;
    passivo: number;
    patrimonio_liquido: number;
    fecha: boolean;
  };
  dre_por_ano: Array<{ ano: number; linhas: Array<{ descricao: string; valor: number }> }>;
  apuracao_impostos: Array<{
    periodo: string;
    imposto: string;
    debito: number;
    credito: number;
    a_pagar: number;
  }>;
  auditoria_r08: {
    total_divergencias: number;
    credito_recuperavel_total: number;
    top_10: Array<{
      numero_nf: string;
      ncm: string;
      cst_pis_cofins: string;
      valor_nota: number;
      credito_recuperavel: number;
      descricao: string;
    }>;
  };
  reforma_tributaria_2027: {
    pre_reforma_pis_cofins_ipi: number;
    transicao_2026_cbs_ibs: number;
    reforma_2027_total: {
      cbs: number;
      ibs: number;
      is_seletivo: number;
      total: number;
    };
  };
  top_10_produtos: Array<{ descricao: string; ncm: string; qtd_notas: number; total: number }>;
  top_10_fornecedores: Array<{ nome: string; qtd_notas: number; total: number }>;
  fluxo_mensal: Array<{ mes: string; entradas: number; saidas: number; saldo: number }>;
  auditoria_cfop: Array<{ cfop: string; operacao: string; qtd: number; total: number }>;
};

export async function gerarDossieIA(): Promise<DossieIA | null> {
  const emp = await getEmpresaAtiva();
  if (!emp) return null;
  const eid = emp.id;

  // Período
  const periodoQ = await db.execute<{ min: string; max: string; dias: string }>(sql`
    SELECT MIN(data_emissao)::text AS min, MAX(data_emissao)::text AS max,
           COALESCE((MAX(data_emissao) - MIN(data_emissao))::text, '0') AS dias
    FROM notas_fiscais WHERE empresa_id = ${eid}
  `);
  const p = periodoQ.rows[0] ?? { min: null, max: null, dias: "0" };

  // Contagem por tipo
  const contQ = await db.execute<{ tipo: string; fin: string; qtd: string; total: string }>(sql`
    SELECT tipo_operacao AS tipo, finalidade AS fin, COUNT(*)::text AS qtd,
           COALESCE(SUM(valor_total),0)::text AS total
    FROM notas_fiscais WHERE empresa_id = ${eid}
    GROUP BY tipo_operacao, finalidade
  `);
  let qtd_saida = 0, qtd_entrada = 0, qtd_servico = 0;
  for (const r of contQ.rows) {
    const q = Number(r.qtd);
    if (r.tipo === "SAIDA") qtd_saida += q;
    else qtd_entrada += q;
    if (r.fin === "SERVICO") qtd_servico += q;
  }

  const [
    resumoD,
    balD,
    apD,
    audD,
    reformaD,
    top10Prod,
    top10Forn,
    fluxo,
    cfopD,
  ] = await Promise.all([
    dashboardResumo(eid),
    balanco(eid),
    apuracao(eid),
    auditoriaR08(eid),
    comparativoAntesDepois(eid),
    db.execute<{ xprod: string; ncm: string; qtd: string; total: string }>(sql`
      SELECT i.xprod, i.ncm, COUNT(DISTINCT i.id_nf)::text AS qtd, COALESCE(SUM(i.valor_total),0)::text AS total
      FROM itens_nf i JOIN notas_fiscais n ON i.id_nf = n.id
      WHERE n.empresa_id = ${eid}
      GROUP BY i.xprod, i.ncm
      ORDER BY SUM(i.valor_total) DESC
      LIMIT 10
    `),
    topDespesas(eid, 10),
    fluxoCaixaMensal(eid),
    db.execute<{ cfop: string; operacao: string; qtd: string; total: string }>(sql`
      SELECT i.cfop, n.tipo_operacao AS operacao, COUNT(*)::text AS qtd,
             COALESCE(SUM(i.valor_total),0)::text AS total
      FROM itens_nf i JOIN notas_fiscais n ON i.id_nf = n.id
      WHERE n.empresa_id = ${eid} AND i.cfop IS NOT NULL AND i.cfop <> ''
      GROUP BY i.cfop, n.tipo_operacao
      ORDER BY SUM(i.valor_total) DESC
      LIMIT 20
    `),
  ]);

  // DRE por ano
  const anosQ = await db.execute<{ ano: string }>(sql`
    SELECT DISTINCT extract(year FROM data_emissao)::text AS ano FROM notas_fiscais
    WHERE empresa_id = ${eid} AND data_emissao IS NOT NULL ORDER BY 1
  `);
  const dre_por_ano = [];
  for (const a of anosQ.rows) {
    const ano = Number(a.ano);
    const linhas = await dre(eid, ano);
    dre_por_ano.push({
      ano,
      linhas: linhas.map((l) => ({ descricao: l.descricao, valor: l.valor })),
    });
  }

  return {
    gerado_em: new Date().toISOString(),
    empresa: {
      nome: emp.nome,
      cnpj: emp.cnpj,
      regime: emp.regime,
      anexo_simples: emp.anexo_simples ?? null,
      rbt12: Number(emp.rbt12 ?? 0),
    },
    periodo: {
      data_inicio: p.min,
      data_fim: p.max,
      dias: Number(p.dias || 0),
    },
    resumo: {
      qtd_notas: resumoD.qtd_notas,
      qtd_notas_saida: qtd_saida,
      qtd_notas_entrada: qtd_entrada,
      qtd_notas_servico: qtd_servico,
      faturamento_saidas: resumoD.receitas,
      total_compras: resumoD.despesas,
      total_impostos_a_pagar: resumoD.impostos_apurados,
      saldo_bancos: resumoD.saldo_bancario,
      contas_a_receber: resumoD.contas_receber,
      contas_a_pagar: resumoD.contas_pagar,
    },
    balanco: {
      ativo: balD.ativo,
      passivo: balD.passivo,
      patrimonio_liquido: balD.pl,
      fecha: Math.abs(balD.ativo - balD.passivo - balD.pl) < 1,
    },
    dre_por_ano,
    apuracao_impostos: apD,
    auditoria_r08: {
      total_divergencias: audD.length,
      credito_recuperavel_total: audD.reduce((a, r) => a + r.valor_credito, 0),
      top_10: audD.slice(0, 10).map((r) => ({
        numero_nf: r.numero_nf,
        ncm: r.ncm,
        cst_pis_cofins: `${r.cst_pis}/${r.cst_cof}`,
        valor_nota: r.valor_nota,
        credito_recuperavel: r.valor_credito,
        descricao: r.descricao ?? "",
      })),
    },
    reforma_tributaria_2027: {
      pre_reforma_pis_cofins_ipi: reformaD.pre_reforma.total_extintos,
      transicao_2026_cbs_ibs: reformaD.transicao_2026.cbs_teste + reformaD.transicao_2026.ibs_teste,
      reforma_2027_total: {
        cbs: reformaD.reforma_2027.cbs,
        ibs: reformaD.reforma_2027.ibs,
        is_seletivo: reformaD.reforma_2027.is,
        total: reformaD.reforma_2027.total_novos,
      },
    },
    top_10_produtos: top10Prod.rows.map((r) => ({
      descricao: r.xprod,
      ncm: r.ncm,
      qtd_notas: Number(r.qtd),
      total: Number(r.total),
    })),
    top_10_fornecedores: top10Forn.map((r) => ({
      nome: r.participante,
      qtd_notas: r.qtd,
      total: r.total,
    })),
    fluxo_mensal: fluxo,
    auditoria_cfop: cfopD.rows.map((r) => ({
      cfop: r.cfop,
      operacao: r.operacao,
      qtd: Number(r.qtd),
      total: Number(r.total),
    })),
  };
}

// Formata o dossiê como TEXTO estruturado (markdown) para colar em IAs
export function formatarDossieTexto(d: DossieIA): string {
  const l: string[] = [];
  l.push("# DOSSIÊ CONTÁBIL-FISCAL PARA ANÁLISE POR IA");
  l.push(`Gerado em: ${new Date(d.gerado_em).toLocaleString("pt-BR")}`);
  l.push(`Sistema: SIGC Contábil Pro v5.0`);
  l.push("");
  l.push("## 1. IDENTIFICAÇÃO DA EMPRESA");
  l.push(`- Razão Social: ${d.empresa.nome}`);
  l.push(`- CNPJ: ${d.empresa.cnpj}`);
  l.push(`- Regime Tributário: ${d.empresa.regime}`);
  if (d.empresa.regime === "SIMPLES") {
    l.push(`- Anexo do Simples: ${d.empresa.anexo_simples ?? "I"}`);
    l.push(`- RBT12 (receita últimos 12 meses): R$ ${fmt(d.empresa.rbt12)}`);
  }
  l.push("");
  l.push("## 2. PERÍODO ESCRITURADO");
  l.push(`- De: ${d.periodo.data_inicio ?? "-"}`);
  l.push(`- Até: ${d.periodo.data_fim ?? "-"}`);
  l.push(`- Total de dias: ${d.periodo.dias}`);
  l.push("");
  l.push("## 3. RESUMO DE NOTAS FISCAIS");
  l.push(`- Total processadas: ${d.resumo.qtd_notas}`);
  l.push(`- Saídas (vendas): ${d.resumo.qtd_notas_saida}`);
  l.push(`- Entradas (compras): ${d.resumo.qtd_notas_entrada}`);
  l.push(`- Serviços: ${d.resumo.qtd_notas_servico}`);
  l.push(`- Faturamento total (saídas): R$ ${fmt(d.resumo.faturamento_saidas)}`);
  l.push(`- Total de compras (entradas): R$ ${fmt(d.resumo.total_compras)}`);
  l.push("");
  l.push("## 4. BALANÇO PATRIMONIAL");
  l.push(`- ATIVO: R$ ${fmt(d.balanco.ativo)}`);
  l.push(`- PASSIVO: R$ ${fmt(d.balanco.passivo)}`);
  l.push(`- PATRIMÔNIO LÍQUIDO: R$ ${fmt(d.balanco.patrimonio_liquido)}`);
  l.push(`- Fecha (A = P + PL)? ${d.balanco.fecha ? "SIM ✓" : "NÃO ✗"}`);
  l.push("");
  l.push("## 5. DRE POR EXERCÍCIO");
  for (const ano of d.dre_por_ano) {
    l.push(`### DRE ${ano.ano}`);
    for (const line of ano.linhas) {
      l.push(`- ${line.descricao}: R$ ${fmt(line.valor)}`);
    }
    l.push("");
  }
  l.push("## 6. APURAÇÃO DE IMPOSTOS");
  const totalApagar = d.apuracao_impostos.reduce((a, r) => a + r.a_pagar, 0);
  l.push(`Total a recolher: R$ ${fmt(totalApagar)}`);
  l.push("");
  l.push("| Período | Imposto | Débito | Crédito | A Pagar |");
  l.push("|---------|---------|--------|---------|---------|");
  for (const r of d.apuracao_impostos) {
    l.push(`| ${r.periodo} | ${r.imposto} | ${fmt(r.debito)} | ${fmt(r.credito)} | ${fmt(r.a_pagar)} |`);
  }
  l.push("");
  l.push("## 7. AUDITORIA R08 — MONOFÁSICO PIS/COFINS");
  l.push(`- Divergências detectadas: ${d.auditoria_r08.total_divergencias}`);
  l.push(`- Crédito recuperável estimado: R$ ${fmt(d.auditoria_r08.credito_recuperavel_total)}`);
  if (d.auditoria_r08.top_10.length > 0) {
    l.push("");
    l.push("Top 10 divergências:");
    for (const r of d.auditoria_r08.top_10) {
      l.push(`- NF ${r.numero_nf}: NCM ${r.ncm}, CST=${r.cst_pis_cofins}, valor R$ ${fmt(r.valor_nota)}, crédito R$ ${fmt(r.credito_recuperavel)}`);
    }
  }
  l.push("");
  l.push("## 8. REFORMA TRIBUTÁRIA (EC 132/2023 + LC 214/2025)");
  l.push(`- Pré-Reforma (≤2025) — PIS+COFINS+IPI: R$ ${fmt(d.reforma_tributaria_2027.pre_reforma_pis_cofins_ipi)}`);
  l.push(`- Transição 2026 — CBS 0,9% + IBS 0,1% teste: R$ ${fmt(d.reforma_tributaria_2027.transicao_2026_cbs_ibs)}`);
  l.push(`- Reforma 2027+ TOTAL: R$ ${fmt(d.reforma_tributaria_2027.reforma_2027_total.total)}`);
  l.push(`  - CBS (8,8%): R$ ${fmt(d.reforma_tributaria_2027.reforma_2027_total.cbs)}`);
  l.push(`  - IBS: R$ ${fmt(d.reforma_tributaria_2027.reforma_2027_total.ibs)}`);
  l.push(`  - Imposto Seletivo: R$ ${fmt(d.reforma_tributaria_2027.reforma_2027_total.is_seletivo)}`);
  l.push("");
  l.push("## 9. TOP 10 PRODUTOS MAIS VENDIDOS");
  for (const p of d.top_10_produtos) {
    l.push(`- ${p.descricao} (NCM ${p.ncm}): ${p.qtd_notas} notas, total R$ ${fmt(p.total)}`);
  }
  l.push("");
  l.push("## 10. TOP 10 FORNECEDORES");
  for (const f of d.top_10_fornecedores) {
    l.push(`- ${f.nome}: ${f.qtd_notas} notas, total R$ ${fmt(f.total)}`);
  }
  l.push("");
  l.push("## 11. FLUXO DE CAIXA MENSAL");
  l.push("| Mês | Entradas | Saídas | Saldo Acumulado |");
  l.push("|-----|----------|--------|-----------------|");
  for (const m of d.fluxo_mensal) {
    l.push(`| ${m.mes} | ${fmt(m.entradas)} | ${fmt(m.saidas)} | ${fmt(m.saldo)} |`);
  }
  l.push("");
  l.push("## 12. CFOP UTILIZADOS (top 20)");
  l.push("| CFOP | Operação | Qtd | Total |");
  l.push("|------|----------|-----|-------|");
  for (const c of d.auditoria_cfop) {
    l.push(`| ${c.cfop} | ${c.operacao} | ${c.qtd} | ${fmt(c.total)} |`);
  }
  l.push("");
  l.push("---");
  l.push("## PERGUNTAS SUGERIDAS PARA A IA");
  l.push("");
  l.push("1. **Análise fiscal**: Existem inconsistências entre os impostos apurados e o regime tributário informado? A alíquota efetiva está adequada para a faixa de faturamento?");
  l.push("");
  l.push("2. **Auditoria monofásica**: As divergências detectadas na regra R08 são todas legítimas? Vale a pena entrar com PER/DCOMP?");
  l.push("");
  l.push("3. **Reforma Tributária 2027**: Considerando o perfil dessa empresa, qual será o impacto real da CBS/IBS/IS quando entrar em vigor? Ela ganha ou perde com a Reforma?");
  l.push("");
  l.push("4. **Recomendações estratégicas**: Baseado no DRE, apuração e perfil de compras/vendas, quais os 3 principais riscos e as 3 principais oportunidades desta empresa?");
  l.push("");
  l.push("5. **CFOP e classificação**: Os CFOPs utilizados são coerentes com a atividade da empresa? Alguma classificação parece equivocada?");
  l.push("");
  l.push("6. **Planejamento tributário**: Vale a pena migrar de regime? Se sim, para qual e por quê?");
  l.push("");
  l.push("_Fim do dossiê._");

  return l.join("\n");
}
