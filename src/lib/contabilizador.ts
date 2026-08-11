// Motor de contabilizaÃ§Ã£o OTIMIZADO - batch inserts + transaÃ§Ã£o
// Suporta Simples, Lucro Presumido e Lucro Real + Reforma TributÃ¡ria 2026-2033

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
import { calcularImpostosNotaReforma, modoReformaParaData } from "./reforma";

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
  if (Math.abs(sD - sC) >= 0.01) throw new Error(`LanÃ§amento desbalanceado: ${hist}`);
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
  const cmv_percent = input.cmv_percent ?? 0.6;
  const recupera_ipi = !!input.recupera_ipi;
  const aliqMono = aliqCreditoMono[regime];

  // ============================================================
  // FASE 0.1 â€” FILTRO DE NF-e CANCELADAS/DENEGADAS
  // SEFAZ retorna cStat=101 (cancelada), 110/205/301 (denegada),
  // 302 (denegada Uso), 205 (NF-e cancelada). NÃƒO CONTAR essas.
  // SÃ³ cStat=100 (Autorizada) e 150 (Autorizada fora de prazo) entram.
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
  // FASE 0.2 â€” DEDUPLICAÃ‡ÃƒO POR CHAVE DE ACESSO
  // Pastas do SEFAZ tipicamente tÃªm 2-3 XMLs por NF (autorizaÃ§Ã£o + eventos +
  // cancelamento + carta de correÃ§Ã£o). Sem dedup, o faturamento sai 2-3x
  // maior que o real e a alÃ­quota do Simples tambÃ©m fica errada.
  // ============================================================
  // 1) Dedup interno do prÃ³prio lote
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
  // 2) Dedup contra NFs JÃ existentes no banco (lotes anteriores do mesmo cliente)
  // Usa array como UM ÃšNICO parÃ¢metro text[] para nÃ£o estourar o limite de params do Postgres
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

  // ------- AlÃ­quota efetiva do Simples (calculada sobre notas ÃšNICAS) -------
  // Base = SUM(vNF) puro das saÃ­das venda/serviÃ§o, sem deduzir ST.
  // Mesmo padrÃ£o do Colab v4.1.2 (LC 123/2006).
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
  // FASE 1 â€” BATCH INSERT DAS NOTAS FISCAIS (uma Ãºnica round-trip)
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
  // mapeia Ã­ndice -> nid inserido
  const nids = nfInseridas.map((x) => x.id);

  // ============================================================
  // FASE 2 â€” BATCH INSERT DE ITENS + AUDITORIA + CR/CP
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

    // Auditoria R08 (monofÃ¡sico)
    for (const it of nf.itens) {
      const ncm = (it.ncm || "").replace(/\D/g, "");
      const cstP = (it.cst_pis || "").padStart(2, "0");
      const cstC = (it.cst_cof || "").padStart(2, "0");
      if (MONO_NCM.has(ncm) && (cstP === "01" || cstP === "02") && (cstC === "01" || cstC === "02")) {
        const cred = aliqMono > 0 ? round(it.vprod * aliqMono) : 0;
        const desc =
          `MonofÃ¡sico NCM ${ncm} com CST PIS/COFINS=${cstP}/${cstC} (deveria ser 04/04)` +
          (regime === "SIMPLES" ? " [Simples: reportado, sem crÃ©dito recuperÃ¡vel]" : "");
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

    // ContabilizaÃ§Ã£o
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

      // Reforma TributÃ¡ria
      const reforma = calcularImpostosNotaReforma(nf.itens, dt);
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

  // Batch insert (com chunks de 1000 para nÃ£o estourar limite de parÃ¢metros do PG)
  await batchInsert(itensNf, itensBatch);
  await batchInsert(auditoria, auditBatch);
  await batchInsert(contasReceber, crBatch);
  await batchInsert(contasPagar, cpBatch);

  // ============================================================
  // FASE 3 â€” BATCH INSERT DE LANÃ‡AMENTOS + ITENS
  // ============================================================
  // Usa MAX(numero) em vez de COUNT â€” evita colisÃ£o quando DELETE apaga
  // lanÃ§amentos no meio (ex: reabertura de encerramento entre lotes).
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

  // Insere lanÃ§amentos em batch com RETURNING id, numero
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
  // FASE 4 â€” EXERCICIOS + APURACAO + ENCERRAMENTO
  // ============================================================
  for (const ano of Array.from(anos)) {
    // Cria sÃ³ se ainda nÃ£o existe (idempotente sem depender de UNIQUE constraint)
    const exist = await db
      .select({ id: exercicios.id })
      .from(exercicios)
      .where(and(eq(exercicios.empresa_id, input.empresa_id), eq(exercicios.ano, ano)))
      .limit(1);
    if (exist.length === 0) {
      await db.insert(exercicios).values({ empresa_id: input.empresa_id, ano });
    }
  }

  // DAS unico sobre faturamento total (evita erro de arredondamento por nota)
  if (regime === "SIMPLES" && aliqEfetiva > 0 && baseSaidaLote > 0) {
    const dasTotal = Math.round(baseSaidaLote * aliqEfetiva * 100) / 100;
    if (dasTotal > 0) {
      const anoDas = new Date().getFullYear();
      const diDas = anoDas + "-06-01";
      await inserirLancamentoUnico(input.empresa_id, {
        data: diDas, competencia: diDas, historico: "DAS Simples Nacional - " + anoDas,
        id_nf: null, origem: "DAS", tipo_lanc: "NORMAL",
        itens: [["4.2.08", dasTotal, 0], ["2.1.03.09", 0, dasTotal]],
      });
    }
  }

  await apurarImpostos(input.empresa_id, regime, Array.from(anos));

  // IRPJ/CSLL (Presumido/Real)
  if (regime !== "SIMPLES") {
    for (const ano of Array.from(anos)) {
      const lucro = await lucroContabil(input.empresa_id, ano);
      if (lucro > 0) {
        const irpj = round(lucro * 0.15 + Math.max(lucro - 240000, 0) * 0.10);
        const csll = round(lucro * 0.09);
        const di = `${ano}-12-31`;
        await inserirLancamentoUnico(input.empresa_id, {
          data: di, competencia: di, historico: `ProvisÃ£o IRPJ ${ano}`,
          id_nf: null, origem: "IRPJ_CSLL", tipo_lanc: "NORMAL",
          itens: [["6.3.05", irpj, 0], ["2.1.03.06", 0, irpj]],
        });
        await inserirLancamentoUnico(input.empresa_id, {
          data: di, competencia: di, historico: `ProvisÃ£o CSLL ${ano}`,
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

  // Encerramento de exercÃ­cios
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

// ---------- inserÃ§Ã£o unitÃ¡ria (para casos raros como IRPJ/CSLL/encerramento) ----------
async function inserirLancamentoUnico(empresaId: number, lp: LancPreparado) {
  // MAX + 1 pra evitar colisÃ£o apÃ³s DELETE (reabertura de encerramento)
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

async function apurarImpostos(empresaId: number, regime: Regime, anos: number[]) {
  for (const ano of anos) {
    const ini = `${ano}-01-01`;
    const fim = `${ano}-12-31`;
    await db
      .delete(apuracaoImpostos)
      .where(and(eq(apuracaoImpostos.empresa_id, empresaId), eq(apuracaoImpostos.periodo, String(ano))));
    if (regime === "SIMPLES") {
      const r = await db.execute<{ v: string }>(sql`
        SELECT COALESCE(SUM(li.credito),0)::text AS v FROM lancamento_itens li
        JOIN lancamentos l ON li.id_lanc = l.id
        WHERE li.codigo_conta = '2.1.03.09'
          AND l.empresa_id = ${empresaId}
          AND l.competencia BETWEEN ${ini}::date AND ${fim}::date
      `);
      const dasAno = round(Number(r.rows[0]?.v ?? 0));
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
  // IMPORTANTE: como agora contabilizamos em lotes (mÃºltiplas chamadas seguidas),
  // se o exercÃ­cio jÃ¡ foi encerrado, precisamos REABRIR â€” remover os lanÃ§amentos
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



