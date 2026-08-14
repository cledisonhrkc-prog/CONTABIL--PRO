// Motor de contabilização OTIMIZADO - batch inserts + transação
// Suporta Simples, Lucro Presumido e Lucro Real + Reforma Tributária 2026-2033

import { db } from "@/db";
import {
  notasFiscais,
  itensNf,
  lancamentos,
  lancamentoItens,
  auditoria,
  contasReceber,
  contasPagar,
  empresas,
  apuracaoImpostos,
  exercicios,
  planoContas,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NF } from "./nfe-parser";
import { aliquotaEfetivaSimples, MONO_NCM } from "./simples";
import { PLANO_CONTAS_PADRAO } from "./plano-contas";
import { calcularImpostosNotaReforma, modoReformaParaData, buscarAliquotasVigentes } from "./reforma";

export type Regime = "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";

type LancItem = [string, number, number];
type LancPreparado = {
  data: string;
  competencia: string;
  historico: string;
  id_nf: number | null;
  origem: string;
  tipo_lanc: string;
  itens: LancItem[];
};

const round = (n: number) => Math.round(n * 100) / 100;

async function ensurePlano() {
  await db
    .insert(planoContas)
    .values(PLANO_CONTAS_PADRAO)
    .onConflictDoNothing({ target: planoContas.codigo });
}

// ---------- helpers ----------
function balancearItens(itens: LancItem[], hist: string): LancItem[] {
  const arr = itens.map((x) => [...x] as LancItem);
  let sD = round(arr.reduce((a, [, d]) => a + d, 0));
  let sC = round(arr.reduce((a, [, , c]) => a + c, 0));
  const dif = round(sD - sC);
  if (Math.abs(dif) >= 0.01) {
    if (dif > 0) {
      let k = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i][2] > arr[k][2]) k = i;
      arr[k][2] = round(arr[k][2] + dif);
    } else {
      let k = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i][1] > arr[k][1]) k = i;
      arr[k][1] = round(arr[k][1] - dif);
    }
  }
  sD = round(arr.reduce((a, [, d]) => a + d, 0));
  sC = round(arr.reduce((a, [, , c]) => a + c, 0));
  if (Math.abs(sD - sC) >= 0.01) throw new Error(`Lançamento desbalanceado: ${hist}`);
  return arr;
}

function totalLanc(itens: LancItem[]): number {
  return round(itens.reduce((a, [, d]) => a + d, 0));
}

// ---------- API principal ----------
export type ContabilizarInput = {
  empresa_id: number;
  regime: Regime;
  rbt12?: number | null;
  anexo?: string;
  cmv_percent?: number;
  recupera_ipi?: boolean;
  nfs: NF[];
};

export type ContabilizarResult = {
  lotesProcessados: number;
  lancamentos: number;
  aliquotaEfetivaSimples: number;
  rbt12Usado: number;
  rbt12Estimado: boolean;
  tempoMs: number;
  dedup: {
    recebidas: number;
    canceladas_ou_denegadas: number;
    duplicadas_no_lote: number;
    duplicadas_no_banco: number;
    unicas_processadas: number;
    rejeicoes_por_status: Record<string, number>;
  };
  auditoriaR08: {
    erros: number;
    creditoRecuperavel: number;
  };
};

export async function contabilizarLote(input: ContabilizarInput): Promise<ContabilizarResult> {
  const t0 = Date.now();
  await ensurePlano();

  const regime = input.regime;
  const creditaPisCofinsEntrada = regime === "LUCRO_REAL";
  const segregaTributosSaida = regime !== "SIMPLES";
  const aliqCreditoMono: Record<Regime, number> = {
    LUCRO_REAL: 0.0925,
    LUCRO_PRESUMIDO: 0.0365,
    SIMPLES: 0.0,
  };
  const cmvRealQ = await db.execute<{ compras: string; vendas: string }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN tipo_operacao = 'ENTRADA' THEN valor_produtos ELSE 0 END), 0)::text AS compras,
      COALESCE(SUM(CASE WHEN tipo_operacao = 'SAIDA' THEN valor_produtos ELSE 0 END), 0)::text AS vendas
    FROM notas_fiscais
    WHERE empresa_id = ${input.empresa_id}
  `);
  const comprasReais = Number(cmvRealQ.rows[0]?.compras ?? 0);
  const vendasReais = Number(cmvRealQ.rows[0]?.vendas ?? 0);
  // Se ja existem compras (ENTRADA) reais registradas para esta empresa, calcula
  // o CMV pela proporcao real compras/vendas em vez do percentual estimado fixo.
  // So cai no percentual estimado (default 60%) quando ainda nao ha nenhuma
  // compra real importada -- assim o DRE fica preciso assim que o cliente
  // importar as notas de compra, sem precisar de nenhuma configuracao manual.
  const cmvRealDisponivel = comprasReais > 0 && vendasReais > 0;
  const cmv_percent_calculado = cmvRealDisponivel
    ? Math.min(0.95, Math.max(0.05, comprasReais / vendasReais))
    : (input.cmv_percent ?? 0.6);
  const cmv_percent = cmv_percent_calculado;
  const aliquotasReforma = await buscarAliquotasVigentes();
  const recupera_ipi = !!input.recupera_ipi;
  const aliqMono = aliqCreditoMono[regime];

  // ============================================================
  // FASE 0.1 — FILTRO DE NF-e CANCELADAS/DENEGADAS
  // SEFAZ retorna cStat=101 (cancelada), 110/205/301 (denegada),
  // 302 (denegada Uso), 205 (NF-e cancelada). NÃO CONTAR essas.
  // Só cStat=100 (Autorizada) e 150 (Autorizada fora de prazo) entram.
  // ============================================================
  const STATUS_VALIDOS = new Set(["100", "150"]);
  const nfsAutorizadas: NF[] = [];
  const rejeicoesStatus: Record<string, number> = {};
  for (const nf of input.nfs) {
    const cs = String(nf.cStat ?? "100");
    if (STATUS_VALIDOS.has(cs)) {
      nfsAutorizadas.push(nf);
    } else {
      rejeicoesStatus[cs] = (rejeicoesStatus[cs] ?? 0) + 1;
    }
  }
  const canceladasDenegadas = input.nfs.length - nfsAutorizadas.length;

  // ============================================================
  // FASE 0.2 — DEDUPLICAÇÃO POR CHAVE DE ACESSO
  // Pastas do SEFAZ tipicamente têm 2-3 XMLs por NF (autorização + eventos +
  // cancelamento + carta de correção). Sem dedup, o faturamento sai 2-3x
  // maior que o real e a alíquota do Simples também fica errada.
  // ============================================================
  // 1) Dedup interno do próprio lote
  const chavesVistas = new Set<string>();
  const nfsUnicas: NF[] = [];
  let dupNoLote = 0;
  for (const nf of nfsAutorizadas) {
    const key = (nf.chave || "").trim() || `${nf.numero}|${nf.serie}|${nf.valor_total}`;
    if (chavesVistas.has(key)) {
      dupNoLote++;
      continue;
    }
    chavesVistas.add(key);
    nfsUnicas.push(nf);
  }
  // 2) Dedup contra NFs JÁ existentes no banco (lotes anteriores do mesmo cliente)
  // Usa array como UM ÚNICO parâmetro text[] para não estourar o limite de params do Postgres
  const chavesArr = Array.from(chavesVistas);
  let jaNoBanco = new Set<string>();
  if (chavesArr.length > 0) {
    const existentes = await db.execute<{ chave: string }>(sql`
      SELECT chave FROM notas_fiscais
      WHERE empresa_id = ${input.empresa_id}
        AND chave = ANY(${sql.raw(`ARRAY[${chavesArr.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")}]::text[]`)})
    `);
    jaNoBanco = new Set(existentes.rows.map((r) => r.chave));
  }
  const nfsProcessar = nfsUnicas.filter((nf) => !jaNoBanco.has(nf.chave));
  const dupBanco = nfsUnicas.length - nfsProcessar.length;

  // ------- Alíquota efetiva do Simples (calculada sobre notas ÚNICAS) -------
  // Base = SUM(vNF) puro das saídas venda/serviço, sem deduzir ST.
  // Mesmo padrão do Colab v4.1.2 (LC 123/2006).
  const baseSaidaLote = round(
    nfsProcessar
      .filter((n) => n.tipo_operacao === "SAIDA" && (n.finalidade === "VENDA" || n.finalidade === "SERVICO"))
      .reduce((a, n) => a + n.valor_total, 0)
  );
  const rbt12Real = input.rbt12 ?? null;
  const rbt12Estimado = !rbt12Real || rbt12Real <= 0;
  // RBT12 automatico: soma faturamento de saida dos ultimos 12 meses JA no banco + este lote
  const rbt12HistoricoQ = await db.execute<{ s: string }>(sql`SELECT COALESCE(SUM(valor_total),0)::text AS s FROM notas_fiscais WHERE empresa_id=${input.empresa_id} AND tipo_operacao='SAIDA' AND data_emissao >= (CURRENT_DATE - INTERVAL '12 months')`);
  const rbt12Historico = Number(rbt12HistoricoQ.rows[0]?.s ?? 0);
  const baseSaidaTotal = rbt12Historico + baseSaidaLote;
  const mesesQ = await db.execute<{ m: string }>(sql`SELECT COUNT(DISTINCT date_trunc('month', data_emissao))::text AS m FROM notas_fiscais WHERE empresa_id=${input.empresa_id} AND tipo_operacao='SAIDA'`);
  const mesesComFat = Math.max(1, Number(mesesQ.rows[0]?.m ?? 1));
  const rbt12Usado = rbt12Estimado ? round((baseSaidaTotal / mesesComFat) * 12) : Number(rbt12Real);
  const aliqEfetiva = regime === "SIMPLES" ? aliquotaEfetivaSimples(rbt12Usado, input.anexo ?? "I") : 0;

  const anos = new Set<number>();
  let auditErros = 0;
  let auditCredito = 0;

  // ============================================================
  // FASE 1 — BATCH INSERT DAS NOTAS FISCAIS (uma única round-trip)
  // ============================================================
  const nfPayload = nfsProcessar.map((nf) => ({
    empresa_id: input.empresa_id,
    chave: nf.chave,
    numero: nf.numero,
    serie: nf.serie,
    modelo: nf.modelo,
    tipo_operacao: nf.tipo_operacao,
    finalidade: nf.finalidade,
    data_emissao: nf.data_emissao,
    participante: nf.participante,
    cnpj_part: nf.cnpj_part,
    valor_produtos: String(nf.valor_produtos),
    valor_frete: String(nf.valor_frete),
    valor_seguro: String(nf.valor_seguro),
    valor_desconto: String(nf.valor_desconto),
    valor_outras: String(nf.valor_outras),
    valor_total: String(nf.valor_total),
    valor_icms: String(nf.valor_icms),
    valor_icms_st: String(nf.valor_icms_st),
    valor_ipi: String(nf.valor_ipi),
    valor_pis: String(nf.valor_pis),
    valor_cofins: String(nf.valor_cofins),
    valor_iss: String(nf.valor_iss),
  }));

  const nfInseridas =
    nfPayload.length > 0
      ? await db.insert(notasFiscais).values(nfPayload).returning({ id: notasFiscais.id })
      : [];
  // mapeia índice -> nid inserido
  const nids = nfInseridas.map((x) => x.id);

  // ============================================================
  // FASE 2 — BATCH INSERT DE ITENS + AUDITORIA + CR/CP
  // ============================================================
  type ItemRow = {
    id_nf: number;
    cprod: string;
    xprod: string;
    ncm: string;
    cfop: string;
    quantidade: string;
    valor_unitario: string;
    valor_total: string;
    cst_pis: string;
    cst_cof: string;
  };
  const itensBatch: ItemRow[] = [];
  const auditBatch: Array<typeof auditoria.$inferInsert> = [];
  const crBatch: Array<typeof contasReceber.$inferInsert> = [];
  const cpBatch: Array<typeof contasPagar.$inferInsert> = [];
  const lancamentosPreparados: LancPreparado[] = [];

  for (let idx = 0; idx < nfsProcessar.length; idx++) {
    const nf = nfsProcessar[idx];
    const nid = nids[idx];
    if (!nid) continue;

    // itens
    for (const it of nf.itens) {
      itensBatch.push({
        id_nf: nid,
        cprod: it.cprod,
        xprod: it.xprod,
        ncm: it.ncm,
        cfop: it.cfop,
        quantidade: String(it.qtd),
        valor_unitario: String(it.vun),
        valor_total: String(it.vprod),
        cst_pis: it.cst_pis,
        cst_cof: it.cst_cof,
      });
    }

    // Auditoria R08 (monofásico)
    for (const it of nf.itens) {
      const ncm = (it.ncm || "").replace(/\D/g, "");
      const cstP = (it.cst_pis || "").padStart(2, "0");
      const cstC = (it.cst_cof || "").padStart(2, "0");
      if (MONO_NCM.has(ncm) && (cstP === "01" || cstP === "02") && (cstC === "01" || cstC === "02")) {
        const cred = aliqMono > 0 ? round(it.vprod * aliqMono) : 0;
        const desc =
          `Monofásico NCM ${ncm} com CST PIS/COFINS=${cstP}/${cstC} (deveria ser 04/04)` +
          (regime === "SIMPLES" ? " [Simples: reportado, sem crédito recuperável]" : "");
        auditBatch.push({
          empresa_id: input.empresa_id,
          id_nf: nid,
          numero_nf: nf.numero,
          regra: "R08",
          tipo: "CRITICO",
          ncm,
          cst_pis: cstP,
          cst_cof: cstC,
          descricao: desc,
          valor_nota: String(it.vprod),
          valor_credito: String(cred),
          regime,
          acao: "CST->04; retificar EFD-Contribuicoes/DCTF; PER/DCOMP.",
        });
        auditErros++;
        auditCredito = round(auditCredito + cred);
      }
    }

    // Contabilização
    const dt = nf.data_emissao;
    anos.add(parseInt(dt.substring(0, 4), 10));
    const vtot = nf.valor_total;
    const vprod = nf.valor_produtos;
    const vicms = nf.valor_icms;
    const vipi = nf.valor_ipi;
    const vpis = nf.valor_pis;
    const vcof = nf.valor_cofins;
    const viss = nf.valor_iss;
    const vst = nf.valor_icms_st;
    const emiDate = new Date(dt);
    const venc = new Date(emiDate.getTime() + 30 * 86400000).toISOString().substring(0, 10);

    if (nf.tipo_operacao === "SAIDA" && (nf.finalidade === "VENDA" || nf.finalidade === "SERVICO")) {
      const contaRec = nf.finalidade === "SERVICO" ? "4.1.03" : "4.1.01";
      const rec = round(vtot - vst);
      const it: LancItem[] = [
        ["1.1.02.01", vtot, 0],
        [contaRec, 0, rec],
      ];
      if (vst > 0) it.push(["2.1.03.08", 0, vst]);
      lancamentosPreparados.push({
        data: dt, competencia: dt,
        historico: `${nf.finalidade} NF ${nf.numero}`,
        id_nf: nid, origem: "FISCAL", tipo_lanc: "NORMAL", itens: it,
      });

      // Reforma Tributária
      const reforma = calcularImpostosNotaReforma(nf.itens, dt, aliquotasReforma);
      const modoRT = reforma.modo;
      const extinguePisCofins =
        modoRT === "REFORMA_2027" || modoRT === "REFORMA_2029" || modoRT === "REFORMA_2033";
      const extingueIpi = extinguePisCofins;
      const extingueIcmsIss = modoRT === "REFORMA_2033";

      const imp: LancItem[] = [];
      if (regime === "SIMPLES") {
        // DAS movido para lancamento unico no final
      } else if (segregaTributosSaida) {
        if (!extingueIcmsIss) {
          if (vicms > 0) imp.push(["4.2.01", vicms, 0], ["2.1.03.01", 0, vicms]);
          if (viss > 0) imp.push(["4.2.05", viss, 0], ["2.1.03.05", 0, viss]);
        }
        if (!extinguePisCofins) {
          if (vpis > 0) imp.push(["4.2.02", vpis, 0], ["2.1.03.03", 0, vpis]);
          if (vcof > 0) imp.push(["4.2.03", vcof, 0], ["2.1.03.04", 0, vcof]);
        }
        if (!extingueIpi) {
          if (vipi > 0) imp.push(["4.2.06", vipi, 0], ["2.1.03.02", 0, vipi]);
        }
        if (reforma.cbs > 0) imp.push(["4.2.09", reforma.cbs, 0], ["2.1.03.10", 0, reforma.cbs]);
        if (reforma.ibs > 0) imp.push(["4.2.10", reforma.ibs, 0], ["2.1.03.11", 0, reforma.ibs]);
        if (reforma.is > 0) imp.push(["4.2.11", reforma.is, 0], ["2.1.03.12", 0, reforma.is]);
      }
      if (imp.length) {
        lancamentosPreparados.push({
          data: dt, competencia: dt,
          historico: `Impostos s/ ${nf.finalidade} NF ${nf.numero}`,
          id_nf: nid, origem: "FISCAL", tipo_lanc: "NORMAL", itens: imp,
        });
      }
      crBatch.push({
        empresa_id: input.empresa_id, id_nf: nid, participante: nf.participante,
        emissao: dt, vencimento: venc, valor: String(vtot),
      });
      if (nf.finalidade === "VENDA") {
        const cmv = round(vprod * cmv_percent);
        if (cmv > 0) {
          lancamentosPreparados.push({
            data: dt, competencia: dt,
            historico: `CMV NF ${nf.numero}`,
            id_nf: nid, origem: "FISCAL", tipo_lanc: "NORMAL",
            itens: [["5.1.01", cmv, 0], ["1.1.03.01", 0, cmv]],
          });
        }
      }
    } else {
      // ENTRADA
      if (nf.finalidade === "SERVICO") {
        const credPis = creditaPisCofinsEntrada ? vpis : 0;
        const credCof = creditaPisCofinsEntrada ? vcof : 0;
        const desp = round(vtot - viss - credPis - credCof);
        const it: LancItem[] = [["6.2.22", desp, 0]];
        if (viss > 0) it.push(["1.1.04.07", viss, 0]);
        if (credPis > 0) it.push(["1.1.04.03", credPis, 0]);
        if (credCof > 0) it.push(["1.1.04.04", credCof, 0]);
        it.push(["2.1.01.01", 0, vtot]);
        lancamentosPreparados.push({
          data: dt, competencia: dt,
          historico: `Serv Terceiros NF ${nf.numero}`,
          id_nf: nid, origem: "FISCAL", tipo_lanc: "NORMAL", itens: it,
        });
      } else {
        let it: LancItem[];
        if (regime === "SIMPLES") {
          const est = round(vtot);
          it = [["1.1.03.01", est, 0]];
        } else {
          const credPis = creditaPisCofinsEntrada ? vpis : 0;
          const credCof = creditaPisCofinsEntrada ? vcof : 0;
          const credIpi = recupera_ipi ? vipi : 0;
          const imp = vicms + credIpi + credPis + credCof;
          const est = round(vtot - imp);
          it = [["1.1.03.01", est, 0]];
          if (vicms > 0) it.push(["1.1.04.01", vicms, 0]);
          if (credIpi > 0) it.push(["1.1.04.02", credIpi, 0]);
          if (credPis > 0) it.push(["1.1.04.03", credPis, 0]);
          if (credCof > 0) it.push(["1.1.04.04", credCof, 0]);
        }
        it.push(["2.1.01.01", 0, vtot]);
        lancamentosPreparados.push({
          data: dt, competencia: dt,
          historico: `Compra NF ${nf.numero}`,
          id_nf: nid, origem: "FISCAL", tipo_lanc: "NORMAL", itens: it,
        });
      }
      cpBatch.push({
        empresa_id: input.empresa_id, id_nf: nid, participante: nf.participante,
        emissao: dt, vencimento: venc, valor: String(vtot),
      });
    }
  }

  // Batch insert (com chunks de 1000 para não estourar limite de parâmetros do PG)
  await batchInsert(itensNf, itensBatch);
  await batchInsert(auditoria, auditBatch);
  await batchInsert(contasReceber, crBatch);
  await batchInsert(contasPagar, cpBatch);

  // ============================================================
  // FASE 3 — BATCH INSERT DE LANÇAMENTOS + ITENS
  // ============================================================
  // Usa MAX(numero) em vez de COUNT — evita colisão quando DELETE apaga
  // lançamentos no meio (ex: reabertura de encerramento entre lotes).
  const maxSeq = await db.execute<{ m: string | null }>(sql`
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 3) AS INTEGER)), 0)::text AS m FROM lancamentos
  `);
  let seq = Number(maxSeq.rows[0]?.m ?? 0);

  const lancRows: Array<typeof lancamentos.$inferInsert> = [];
  const lancItensPorNumero: Map<string, LancItem[]> = new Map();

  for (const lp of lancamentosPreparados) {
    seq++;
    const numero = `LC${String(seq).padStart(8, "0")}`;
    const bal = balancearItens(lp.itens, lp.historico);
    lancItensPorNumero.set(numero, bal);
    lancRows.push({
      empresa_id: input.empresa_id,
      numero,
      data: lp.data,
      competencia: lp.competencia,
      exercicio: parseInt(lp.competencia.substring(0, 4), 10),
      historico: lp.historico,
      id_nf: lp.id_nf,
      origem: lp.origem,
      tipo_lanc: lp.tipo_lanc,
      valor_total: String(totalLanc(bal)),
    });
  }

  // Insere lançamentos em batch com RETURNING id, numero
  const lancInseridos = await batchInsertReturning(lancamentos, lancRows, [
    "id",
    "numero",
  ]);
  const idPorNumero = new Map<string, number>();
  for (const r of lancInseridos) idPorNumero.set(r.numero, r.id);

  const lancItensRows: Array<typeof lancamentoItens.$inferInsert> = [];
  for (const [numero, itens] of lancItensPorNumero) {
    const id_lanc = idPorNumero.get(numero);
    if (!id_lanc) continue;
    for (const [codigo, debito, credito] of itens) {
      lancItensRows.push({
        id_lanc,
        codigo_conta: codigo,
        debito: String(round(debito)),
        credito: String(round(credito)),
      });
    }
  }
  await batchInsert(lancamentoItens, lancItensRows);

  // ============================================================
  // FASE 4 — EXERCICIOS + APURACAO + ENCERRAMENTO
  // ============================================================
  for (const ano of Array.from(anos)) {
    // Cria só se ainda não existe (idempotente sem depender de UNIQUE constraint)
    const exist = await db
      .select({ id: exercicios.id })
      .from(exercicios)
      .where(and(eq(exercicios.empresa_id, input.empresa_id), eq(exercicios.ano, ano)))
      .limit(1);
    if (exist.length === 0) {
      await db.insert(exercicios).values({ empresa_id: input.empresa_id, ano });
    }
  }

  // DAS do Simples: calculado de forma consolidada dentro de apurarImpostos
  // (sobre TODO o faturamento do mes no banco x aliquota efetiva), nao por lote.
  await apurarImpostos(input.empresa_id, regime, Array.from(anos), aliqEfetiva);

  // IRPJ/CSLL (Presumido/Real)
  if (regime !== "SIMPLES") {
    for (const ano of Array.from(anos)) {
      let irpj = 0;
      let csll = 0;
      if (regime === "LUCRO_PRESUMIDO") {
        // Presumido: base de calculo eh PRESUMIDA sobre a receita bruta do
        // periodo (nao sobre o lucro contabil apurado) -- percentuais fixos
        // por atividade (IN RFB 1700/2017, art. 33): comercio 8% (IRPJ) / 12%
        // (CSLL); servicos 32%/32%. Generico para qualquer empresa: usa so a
        // classificacao VENDA/SERVICO que o parser ja atribui a cada nota.
        const ini = `${ano}-01-01`;
        const fim = `${ano}-12-31`;
        const rq = await db.execute<{ venda: string; servico: string }>(sql`
          SELECT
            COALESCE(SUM(CASE WHEN finalidade = 'VENDA' THEN valor_total ELSE 0 END),0)::text AS venda,
            COALESCE(SUM(CASE WHEN finalidade = 'SERVICO' THEN valor_total ELSE 0 END),0)::text AS servico
          FROM notas_fiscais
          WHERE empresa_id = ${input.empresa_id}
            AND tipo_operacao = 'SAIDA'
            AND data_emissao >= ${ini}
            AND data_emissao <= ${fim}
        `);
        const venda = round(Number(rq.rows[0]?.venda ?? 0));
        const servico = round(Number(rq.rows[0]?.servico ?? 0));
        const baseIrpj = round(venda * 0.08 + servico * 0.32);
        const baseCsll = round(venda * 0.12 + servico * 0.32);
        irpj = round(baseIrpj * 0.15 + Math.max(baseIrpj - 240000, 0) * 0.10);
        csll = round(baseCsll * 0.09);
      } else {
        // LUCRO_REAL: IRPJ/CSLL incidem de fato sobre o lucro contabil apurado.
        const lucro = await lucroContabil(input.empresa_id, ano);
        irpj = round(lucro * 0.15 + Math.max(lucro - 240000, 0) * 0.10);
        csll = round(lucro * 0.09);
      }
      if (irpj > 0 || csll > 0) {
        const di = `${ano}-12-31`;
        await inserirLancamentoUnico(input.empresa_id, {
          data: di, competencia: di, historico: `Provisão IRPJ ${ano}`,
          id_nf: null, origem: "IRPJ_CSLL", tipo_lanc: "NORMAL",
          itens: [["6.3.05", irpj, 0], ["2.1.03.06", 0, irpj]],
        });
        await inserirLancamentoUnico(input.empresa_id, {
          data: di, competencia: di, historico: `Provisão CSLL ${ano}`,
          id_nf: null, origem: "IRPJ_CSLL", tipo_lanc: "NORMAL",
          itens: [["6.3.06", csll, 0], ["2.1.03.07", 0, csll]],
        });
        await db.insert(apuracaoImpostos).values([
          {
            empresa_id: input.empresa_id, periodo: String(ano),
            imposto: "IRPJ", debito: String(irpj), credito: "0", apurado: String(irpj), a_pagar: String(irpj),
          },
          {
            empresa_id: input.empresa_id, periodo: String(ano),
            imposto: "CSLL", debito: String(csll), credito: "0", apurado: String(csll), a_pagar: String(csll),
          },
        ]);
      }
    }
  }

  // Encerramento de exercícios
  for (const ano of Array.from(anos)) {
    await encerrarExercicio(input.empresa_id, ano);
  }

  // Atualiza empresa
  await db
    .update(empresas)
    .set({ regime, rbt12: String(rbt12Usado), cmv_percent: String(cmv_percent) })
    .where(eq(empresas.id, input.empresa_id));

  const totalFinal = await db
    .select({ c: sql<number>`count(*)` })
    .from(lancamentos)
    .where(eq(lancamentos.empresa_id, input.empresa_id));

  return {
    lotesProcessados: nfsProcessar.length,
    lancamentos: Number(totalFinal[0]?.c ?? 0),
    aliquotaEfetivaSimples: aliqEfetiva,
    rbt12Usado,
    rbt12Estimado,
    tempoMs: Date.now() - t0,
    dedup: {
      recebidas: input.nfs.length,
      canceladas_ou_denegadas: canceladasDenegadas,
      duplicadas_no_lote: dupNoLote,
      duplicadas_no_banco: dupBanco,
      unicas_processadas: nfsProcessar.length,
      rejeicoes_por_status: rejeicoesStatus,
    },
    auditoriaR08: { erros: auditErros, creditoRecuperavel: auditCredito },
  };
}

// ---------- Helpers de batch insert ----------
async function batchInsert<T extends { $inferInsert: object }>(
  table: T,
  rows: (T extends { $inferInsert: infer R } ? R : never)[]
) {
  if (!rows.length) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table as any).values(slice);
  }
}

async function batchInsertReturning(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  rows: (typeof lancamentos.$inferInsert)[],
  _cols: string[]
): Promise<Array<{ id: number; numero: string }>> {
  if (!rows.length) return [];
  const out: Array<{ id: number; numero: string }> = [];
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const inserted = await db.insert(table).values(slice).returning({ id: lancamentos.id, numero: lancamentos.numero });
    out.push(...inserted);
  }
  return out;
}

// ---------- inserção unitária (para casos raros como IRPJ/CSLL/encerramento) ----------
async function inserirLancamentoUnico(empresaId: number, lp: LancPreparado) {
  // MAX + 1 pra evitar colisão após DELETE (reabertura de encerramento)
  const r = await db.execute<{ m: string | null }>(sql`
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 3) AS INTEGER)), 0)::text AS m FROM lancamentos
  `);
  const seq = Number(r.rows[0]?.m ?? 0) + 1;
  const numero = `LC${String(seq).padStart(8, "0")}`;
  const bal = balancearItens(lp.itens, lp.historico);
  const ex = parseInt(lp.competencia.substring(0, 4), 10);
  const [row] = await db
    .insert(lancamentos)
    .values({
      empresa_id: empresaId,
      numero,
      data: lp.data,
      competencia: lp.competencia,
      exercicio: ex,
      historico: lp.historico,
      id_nf: lp.id_nf,
      origem: lp.origem,
      tipo_lanc: lp.tipo_lanc,
      valor_total: String(totalLanc(bal)),
    })
    .returning({ id: lancamentos.id });
  await db.insert(lancamentoItens).values(
    bal.map(([codigo, debito, credito]) => ({
      id_lanc: row.id,
      codigo_conta: codigo,
      debito: String(round(debito)),
      credito: String(round(credito)),
    }))
  );
  return row.id;
}

async function apurarImpostos(empresaId: number, regime: Regime, anos: number[], aliqDas = 0) {
  for (const ano of anos) {
    const ini = `${ano}-01-01`;
    const fim = `${ano}-12-31`;
    await db
      .delete(apuracaoImpostos)
      .where(and(eq(apuracaoImpostos.empresa_id, empresaId), eq(apuracaoImpostos.periodo, String(ano))));
    if (regime === "SIMPLES") {
      // DAS consolidado: faturamento total de SAIDA (venda/servico) do periodo
      // JA no banco x aliquota efetiva. Um unico calculo, coerente com a aliquota
      // exibida, independente de quantos lotes foram importados (LC 123/2006).
      const fq = await db.execute<{ v: string }>(sql`
        SELECT COALESCE(SUM(valor_total),0)::text AS v FROM notas_fiscais
        WHERE empresa_id = ${empresaId}
          AND tipo_operacao = 'SAIDA'
          AND finalidade IN ('VENDA','SERVICO')
          AND data_emissao BETWEEN ${ini}::date AND ${fim}::date
      `);
      const fatDas = round(Number(fq.rows[0]?.v ?? 0));
      const dasAno = round(fatDas * aliqDas);
      // Remove quaisquer lancamentos de DAS anteriores do periodo (por-lote antigos)
      // para nao duplicar, e insere UM lancamento consolidado.
      await db.execute(sql`
        DELETE FROM lancamento_itens li USING lancamentos l
        WHERE li.id_lanc = l.id
          AND li.codigo_conta = '2.1.03.09'
          AND l.empresa_id = ${empresaId}
          AND l.origem = 'DAS'
          AND l.competencia BETWEEN ${ini}::date AND ${fim}::date
      `);
      await db.execute(sql`
        DELETE FROM lancamentos
        WHERE empresa_id = ${empresaId}
          AND origem = 'DAS'
          AND competencia BETWEEN ${ini}::date AND ${fim}::date
      `);
      if (dasAno > 0) {
        const diDas = `${ano}-06-01`;
        await inserirLancamentoUnico(empresaId, {
          data: diDas, competencia: diDas, historico: `DAS Simples Nacional - ${ano}`,
          id_nf: null, origem: "DAS", tipo_lanc: "NORMAL",
          itens: [["4.2.08", dasAno, 0], ["2.1.03.09", 0, dasAno]],
        });
      }
      await db.insert(apuracaoImpostos).values({
        empresa_id: empresaId, periodo: String(ano),
        imposto: "DAS SIMPLES", debito: String(dasAno), credito: "0",
        apurado: String(dasAno), a_pagar: String(dasAno),
      });
    } else {
      const modoAno = modoReformaParaData(`${ano}-06-01`);
      const extintos = new Set<string>();
      if (modoAno === "REFORMA_2027" || modoAno === "REFORMA_2029" || modoAno === "REFORMA_2033") {
        extintos.add("PIS"); extintos.add("COFINS"); extintos.add("IPI");
      }
      if (modoAno === "REFORMA_2033") { extintos.add("ICMS"); extintos.add("ISS"); }

      const camposMap: Array<[string, string]> = [
        ["ICMS", "valor_icms"], ["PIS", "valor_pis"], ["COFINS", "valor_cofins"],
        ["IPI", "valor_ipi"], ["ISS", "valor_iss"],
      ];
      for (const [imp, campo] of camposMap) {
        if (extintos.has(imp)) continue;
        const r = await db.execute<{ d: string; c: string }>(sql`
          SELECT
            COALESCE(SUM(CASE WHEN tipo_operacao='SAIDA' THEN ${sql.raw(campo)} ELSE 0 END),0) AS d,
            COALESCE(SUM(CASE WHEN tipo_operacao='ENTRADA' THEN ${sql.raw(campo)} ELSE 0 END),0) AS c
          FROM notas_fiscais
          WHERE empresa_id = ${empresaId}
            AND data_emissao BETWEEN ${ini}::date AND ${fim}::date
        `);
        const deb = round(Number(r.rows[0]?.d ?? 0));
        const cred = round(Number(r.rows[0]?.c ?? 0));
        const ap = round(deb - cred);
        await db.insert(apuracaoImpostos).values({
          empresa_id: empresaId, periodo: String(ano), imposto: imp,
          debito: String(deb), credito: String(cred),
          apurado: String(ap), a_pagar: String(ap > 0 ? ap : 0),
        });
      }
      // CBS / IBS / IS
      const impostosReforma: Array<[string, string]> = [
        ["CBS", "2.1.03.10"], ["IBS", "2.1.03.11"], ["IS SELETIVO", "2.1.03.12"],
      ];
      for (const [nome, conta] of impostosReforma) {
        const r = await db.execute<{ v: string }>(sql`
          SELECT COALESCE(SUM(li.credito - li.debito),0)::text AS v
          FROM lancamento_itens li
          JOIN lancamentos l ON li.id_lanc = l.id
          WHERE li.codigo_conta = ${conta}
            AND l.empresa_id = ${empresaId}
            AND l.competencia BETWEEN ${ini}::date AND ${fim}::date
        `);
        const val = round(Number(r.rows[0]?.v ?? 0));
        if (val !== 0) {
          await db.insert(apuracaoImpostos).values({
            empresa_id: empresaId, periodo: String(ano), imposto: nome,
            debito: String(val), credito: "0",
            apurado: String(val), a_pagar: String(val > 0 ? val : 0),
          });
        }
      }
    }
  }
}

async function lucroContabil(empresaId: number, ano: number): Promise<number> {
  const r = await db.execute<{ v: string }>(sql`
    SELECT COALESCE(SUM(
      CASE WHEN p.tipo='RECEITA' THEN li.credito-li.debito
           WHEN p.tipo IN ('CUSTO','DESPESA') THEN -(li.debito-li.credito)
           ELSE 0 END
    ),0)::text AS v
    FROM lancamento_itens li
    JOIN lancamentos l ON li.id_lanc = l.id
    JOIN plano_contas p ON li.codigo_conta = p.codigo
    WHERE l.empresa_id = ${empresaId}
      AND l.exercicio = ${ano}
      AND l.tipo_lanc = 'NORMAL'
      AND p.tipo IN ('RECEITA','CUSTO','DESPESA')
  `);
  return round(Number(r.rows[0]?.v ?? 0));
}

async function encerrarExercicio(empresaId: number, ano: number): Promise<number | null> {
  // IMPORTANTE: como agora contabilizamos em lotes (múltiplas chamadas seguidas),
  // se o exercício já foi encerrado, precisamos REABRIR — remover os lançamentos
  // de encerramento anteriores e refazer com o total acumulado.
  await db.execute(sql`
    DELETE FROM lancamento_itens WHERE id_lanc IN (
      SELECT id FROM lancamentos
      WHERE empresa_id = ${empresaId}
        AND exercicio = ${ano}
        AND tipo_lanc = 'ENCERRAMENTO'
    )
  `);
  await db.execute(sql`
    DELETE FROM lancamentos
    WHERE empresa_id = ${empresaId}
      AND exercicio = ${ano}
      AND tipo_lanc = 'ENCERRAMENTO'
  `);
  await db
    .update(exercicios)
    .set({ status: "ABERTO", resultado: "0" })
    .where(and(eq(exercicios.empresa_id, empresaId), eq(exercicios.ano, ano)));

  const contasR = await db.execute<{ codigo: string; saldo: string }>(sql`
    SELECT li.codigo_conta AS codigo,
      (SUM(li.credito) - SUM(li.debito))::text AS saldo
    FROM lancamento_itens li
    JOIN lancamentos l ON li.id_lanc = l.id
    JOIN plano_contas p ON li.codigo_conta = p.codigo
    WHERE l.empresa_id = ${empresaId}
      AND l.exercicio = ${ano}
      AND l.tipo_lanc = 'NORMAL'
      AND p.tipo IN ('RECEITA','CUSTO','DESPESA')
      AND p.nivel = 4
    GROUP BY li.codigo_conta
  `);
  const itens: LancItem[] = [];
  let resultado = 0;
  for (const row of contasR.rows) {
    const s = round(Number(row.saldo));
    if (Math.abs(s) < 0.01) continue;
    if (s > 0) itens.push([row.codigo, s, 0]);
    else itens.push([row.codigo, 0, -s]);
    resultado = round(resultado + s);
  }
  if (itens.length === 0) return null;
  if (resultado > 0) itens.push(["7.1.01", 0, resultado]);
  else itens.push(["7.1.01", -resultado, 0]);
  const di = `${ano}-12-31`;
  await inserirLancamentoUnico(empresaId, {
    data: di, competencia: di, historico: `Encerramento resultado ${ano}`,
    id_nf: null, origem: "ENCERRAMENTO", tipo_lanc: "ENCERRAMENTO", itens,
  });
  if (resultado > 0) {
    await inserirLancamentoUnico(empresaId, {
      data: di, competencia: di, historico: `Transf resultado ${ano} p/ PL`,
      id_nf: null, origem: "ENCERRAMENTO", tipo_lanc: "ENCERRAMENTO",
      itens: [["7.1.01", resultado, 0], ["3.5.01", 0, resultado]],
    });
  } else {
    await inserirLancamentoUnico(empresaId, {
      data: di, competencia: di, historico: `Transf resultado ${ano} p/ PL`,
      id_nf: null, origem: "ENCERRAMENTO", tipo_lanc: "ENCERRAMENTO",
      itens: [["3.5.01", -resultado, 0], ["7.1.01", 0, -resultado]],
    });
  }
  await db
    .update(exercicios)
    .set({ status: "ENCERRADO", resultado: String(resultado) })
    .where(and(eq(exercicios.empresa_id, empresaId), eq(exercicios.ano, ano)));
  return resultado;
}


// ============================================================
// RECÁLCULO RETROATIVO DE CMV REAL
// Use esta função quando notas de COMPRA (ENTRADA) forem importadas
// DEPOIS das notas de VENDA (SAIDA) já contabilizadas. Ela recalcula
// o cmv_percent real (compras reais / vendas reais) e ajusta todos os
// lançamentos de CMV já gravados, sem precisar apagar e reimportar nada.
// ============================================================
export async function recalcularCmvReal(empresaId: number): Promise<{
  ok: boolean;
  mensagem: string;
  cmv_percent_antigo?: number;
  cmv_percent_novo?: number;
  notas_ajustadas?: number;
}> {
  const cmvRealQ = await db.execute<{ compras: string; vendas: string }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN tipo_operacao = 'ENTRADA' THEN valor_produtos ELSE 0 END), 0)::text AS compras,
      COALESCE(SUM(CASE WHEN tipo_operacao = 'SAIDA' THEN valor_produtos ELSE 0 END), 0)::text AS vendas
    FROM notas_fiscais
    WHERE empresa_id = ${empresaId}
  `);
  const comprasReais = Number(cmvRealQ.rows[0]?.compras ?? 0);
  const vendasReais = Number(cmvRealQ.rows[0]?.vendas ?? 0);

  if (comprasReais <= 0 || vendasReais <= 0) {
    return {
      ok: false,
      mensagem: "Não há compras e vendas suficientes para calcular o CMV real. Nada foi alterado.",
    };
  }

  const empresaAtual = await db.select().from(empresas).where(eq(empresas.id, empresaId)).limit(1);
  const cmvPercentAntigo = Number(empresaAtual[0]?.cmv_percent ?? 0.6);

  const cmvPercentNovo = Math.min(0.95, Math.max(0.05, comprasReais / vendasReais));

  // Ajusta os itens dos lançamentos de CMV já gravados, proporcional ao
  // valor_produtos real de cada nota de venda.
  const ajuste = await db.execute<{ id_lanc: number }>(sql`
    WITH novo AS (
      SELECT l.id AS id_lanc, ROUND(nf.valor_produtos * ${cmvPercentNovo}, 2) AS novo_cmv
      FROM lancamentos l
      JOIN notas_fiscais nf ON l.id_nf = nf.id
      WHERE l.empresa_id = ${empresaId}
        AND l.historico LIKE 'CMV NF %'
        AND l.tipo_lanc = 'NORMAL'
    )
    UPDATE lancamento_itens li
    SET debito = CASE WHEN li.codigo_conta = '5.1.01' THEN novo.novo_cmv ELSE li.debito END,
        credito = CASE WHEN li.codigo_conta = '1.1.03.01' THEN novo.novo_cmv ELSE li.credito END
    FROM novo
    WHERE li.id_lanc = novo.id_lanc
      AND li.codigo_conta IN ('5.1.01', '1.1.03.01')
    RETURNING li.id_lanc
  `);

  await db.execute(sql`
    UPDATE lancamentos l
    SET valor_total = ROUND(nf.valor_produtos * ${cmvPercentNovo}, 2)
    FROM notas_fiscais nf
    WHERE l.id_nf = nf.id
      AND l.empresa_id = ${empresaId}
      AND l.historico LIKE 'CMV NF %'
      AND l.tipo_lanc = 'NORMAL'
  `);

  // Recalcula o(s) exercício(s) afetados, para o balanço fechar de novo
  // com o CMV corrigido (reabre e refaz o lançamento de ENCERRAMENTO).
  const exerciciosQ = await db.execute<{ exercicio: number }>(sql`
    SELECT DISTINCT exercicio FROM lancamentos
    WHERE empresa_id = ${empresaId} AND historico LIKE 'CMV NF %'
  `);
  for (const row of exerciciosQ.rows) {
    await encerrarExercicio(empresaId, Number(row.exercicio));
  }

  await db
    .update(empresas)
    .set({ cmv_percent: String(cmvPercentNovo) })
    .where(eq(empresas.id, empresaId));

  return {
    ok: true,
    mensagem: "CMV recalculado com sucesso usando os dados reais de compras e vendas.",
    cmv_percent_antigo: cmvPercentAntigo,
    cmv_percent_novo: cmvPercentNovo,
    notas_ajustadas: ajuste.rows.length,
  };
}


