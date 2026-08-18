/**
 * MÓDULO FINANCEIRO COMPLETO — Lógica de negócio
 * Contábil Pro | Produção | Brasil
 */

import { createHash } from "crypto";
import { db } from "@/db"; // ajuste o path conforme seu projeto
import {
  eq,
  and,
  sql,
  desc,
  asc,
  gte,
  lte,
  inArray,
  ne,
  or,
  isNull,
} from "drizzle-orm";
import {
  contasReceber,
  contasPagar,
  baixas,
  contasBancarias,
  lancamentosFinanceiros,
  extratosBancarios,
  categoriasFinanceiras,
  centrosCusto,
  conciliacoes,
} from "@/db/schema-financeiro"; // ajuste o path

// ============================================================
// TIPOS
// ============================================================
export type TipoBaixa = "RECEBER" | "PAGAR";
export type StatusConta = "ABERTO" | "PARCIAL" | "PAGO" | "CANCELADO";

export interface BaixaParams {
  empresaId: number;
  tipo: TipoBaixa;
  contaId: number;
  valor: number;
  dataBaixa: string; // YYYY-MM-DD
  contaBancariaId: number;
  formaPagamento?: string;
  observacao?: string;
  usuarioId?: number;
}

export interface LancamentoManualParams {
  empresaId: number;
  tipo: "ENTRADA" | "SAIDA";
  data: string;
  valor: number;
  descricao: string;
  contaBancariaId: number;
  categoriaId?: number;
  centroCustoId?: number;
  participante?: string;
  formaPagamento?: string;
  observacao?: string;
  usuarioId?: number;
}

export interface TransferenciaParams {
  empresaId: number;
  data: string;
  valor: number;
  descricao: string;
  contaOrigemId: number;
  contaDestinoId: number;
  observacao?: string;
  usuarioId?: number;
}

// ============================================================
// BAIXA DE CONTA (parcial ou total)
// ============================================================
export async function baixarConta(params: BaixaParams) {
  const {
    empresaId,
    tipo,
    contaId,
    valor,
    dataBaixa,
    contaBancariaId,
    formaPagamento,
    observacao,
    usuarioId,
  } = params;

  if (valor <= 0) throw new Error("Valor da baixa deve ser maior que zero");

  return await db.transaction(async (tx) => {
    const tabela = tipo === "RECEBER" ? contasReceber : contasPagar;

    const [conta] = await tx
      .select()
      .from(tabela)
      .where(and(eq(tabela.id, contaId), eq(tabela.empresa_id, empresaId)));

    if (!conta) throw new Error("Conta não encontrada");
    if (conta.status === "PAGO") throw new Error("Conta já está paga");
    if (conta.status === "CANCELADO") throw new Error("Conta cancelada");

    const valorTotal = Number(conta.valor);
    const valorPagoAtual = Number(conta.valorPago || 0);
    const saldoRestante = valorTotal - valorPagoAtual;

    if (valor > saldoRestante + 0.009) {
      throw new Error(`Valor da baixa (R$ ${valor.toFixed(2)}) maior que o saldo restante (R$ ${saldoRestante.toFixed(2)})`);
    }

    const novoValorPago = valorPagoAtual + valor;
    let novoStatus: StatusConta = "PARCIAL";
    if (Math.abs(novoValorPago - valorTotal) < 0.01) {
      novoStatus = "PAGO";
    }

    await tx
      .update(tabela)
      .set({
        valorPago: novoValorPago.toFixed(2),
        status: novoStatus,
        updatedAt: new Date(),
      })
      .where(eq(tabela.id, contaId));

    const [baixa] = await tx
      .insert(baixas)
      .values({
        empresaId,
        tipo,
        contaId,
        dataBaixa,
        valor: valor.toFixed(2),
        contaBancariaId,
        formaPagamento: formaPagamento || null,
        observacao: observacao || null,
        usuarioId: usuarioId || null,
      })
      .returning();

    // Lançamento automático na conta bancária
    await tx.insert(lancamentosFinanceiros).values({
      empresaId,
      tipo: tipo === "RECEBER" ? "ENTRADA" : "SAIDA",
      data: dataBaixa,
      valor: valor.toFixed(2),
      descricao: `Baixa ${tipo === "RECEBER" ? "Recebimento" : "Pagamento"} — ${conta.participante}${conta.descricao ? ` (${conta.descricao})` : ""}`,
      contaBancariaId,
      participante: conta.participante,
      formaPagamento: formaPagamento || null,
      status: "CONFIRMADO",
      origem: "BAIXA",
      referenciaId: baixa.id,
      observacao: observacao || null,
      usuarioId: usuarioId || null,
    });

    return {
      baixa,
      status: novoStatus,
      valorPago: novoValorPago,
      saldoRestante: valorTotal - novoValorPago,
    };
  });
}

// ============================================================
// CANCELAR BAIXA (estorno)
// ============================================================
export async function cancelarBaixa(params: {
  empresaId: number;
  baixaId: number;
  usuarioId?: number;
}) {
  const { empresaId, baixaId } = params;

  return await db.transaction(async (tx) => {
    const [baixa] = await tx
      .select()
      .from(baixas)
      .where(and(eq(baixas.id, baixaId), eq(baixas.empresaId, empresaId)));

    if (!baixa) throw new Error("Baixa não encontrada");

    const tabela = baixa.tipo === "RECEBER" ? contasReceber : contasPagar;

    const [conta] = await tx
      .select()
      .from(tabela)
      .where(eq(tabela.id, baixa.contaId));

    if (!conta) throw new Error("Conta vinculada não encontrada");

    const novoValorPago = Math.max(0, Number(conta.valorPago || 0) - Number(baixa.valor));
    let novoStatus: StatusConta = "ABERTO";
    if (novoValorPago > 0.009) novoStatus = "PARCIAL";
    if (Math.abs(novoValorPago - Number(conta.valor)) < 0.01) novoStatus = "PAGO";

    await tx
      .update(tabela)
      .set({
        valorPago: novoValorPago.toFixed(2),
        status: novoStatus,
        updatedAt: new Date(),
      })
      .where(eq(tabela.id, baixa.contaId));

    // Cancela o lançamento gerado pela baixa
    await tx
      .update(lancamentosFinanceiros)
      .set({ status: "CANCELADO", updatedAt: new Date() })
      .where(
        and(
          eq(lancamentosFinanceiros.origem, "BAIXA"),
          eq(lancamentosFinanceiros.referenciaId, baixaId),
          eq(lancamentosFinanceiros.empresaId, empresaId)
        )
      );

    await tx.delete(baixas).where(eq(baixas.id, baixaId));

    return { sucesso: true, novoStatus, valorPago: novoValorPago };
  });
}

// ============================================================
// SALDO REAL DE CONTA BANCÁRIA
// ============================================================
export async function calcularSaldoConta(
  empresaId: number,
  contaBancariaId: number,
  ateData?: string
): Promise<number> {
  const [conta] = await db
    .select()
    .from(contasBancarias)
    .where(
      and(
        eq(contasBancarias.id, contaBancariaId),
        eq(contasBancarias.empresaId, empresaId)
      )
    );

  if (!conta) return 0;

  let saldo = Number(conta.saldoInicial || 0);

  // Movimentações de saída / entrada na conta de origem
  const conditions = [
    eq(lancamentosFinanceiros.empresaId, empresaId),
    eq(lancamentosFinanceiros.contaBancariaId, contaBancariaId),
    eq(lancamentosFinanceiros.status, "CONFIRMADO"),
  ];
  if (ateData) conditions.push(lte(lancamentosFinanceiros.data, ateData));

  const movs = await db
    .select()
    .from(lancamentosFinanceiros)
    .where(and(...conditions));

  for (const m of movs) {
    const v = Number(m.valor);
    if (m.tipo === "ENTRADA") saldo += v;
    else if (m.tipo === "SAIDA") saldo -= v;
    else if (m.tipo === "TRANSFERENCIA") saldo -= v; // saída da origem
  }

  // Transferências recebidas (conta destino)
  const condRecebidas = [
    eq(lancamentosFinanceiros.empresaId, empresaId),
    eq(lancamentosFinanceiros.contaBancariaDestinoId, contaBancariaId),
    eq(lancamentosFinanceiros.tipo, "TRANSFERENCIA"),
    eq(lancamentosFinanceiros.status, "CONFIRMADO"),
  ];
  if (ateData) condRecebidas.push(lte(lancamentosFinanceiros.data, ateData));

  const recebidas = await db
    .select()
    .from(lancamentosFinanceiros)
    .where(and(...condRecebidas));

  for (const r of recebidas) {
    saldo += Number(r.valor);
  }

  return Number(saldo.toFixed(2));
}

// ============================================================
// SALDO TOTAL DE TODAS AS CONTAS
// ============================================================
export async function calcularSaldoTotal(empresaId: number): Promise<{
  total: number;
  porConta: Array<{ id: number; nome: string; saldo: number; tipo: string; cor: string }>;
}> {
  const contas = await db
    .select()
    .from(contasBancarias)
    .where(
      and(eq(contasBancarias.empresaId, empresaId), eq(contasBancarias.ativa, true))
    );

  const porConta: Array<{ id: number; nome: string; saldo: number; tipo: string; cor: string }> = [];
  let total = 0;

  for (const c of contas) {
    const saldo = await calcularSaldoConta(empresaId, c.id);
    total += saldo;
    porConta.push({
      id: c.id,
      nome: c.nome,
      saldo,
      tipo: c.tipo,
      cor: c.cor || "#3B82F6",
    });
  }

  return { total: Number(total.toFixed(2)), porConta };
}

// ============================================================
// CONTAS BANCÁRIAS
// ============================================================
export async function listarContasBancarias(empresaId: number) {
  return db
    .select()
    .from(contasBancarias)
    .where(
      and(eq(contasBancarias.empresaId, empresaId), eq(contasBancarias.ativa, true))
    )
    .orderBy(asc(contasBancarias.nome));
}

// ============================================================
// LANÇAMENTO MANUAL
// ============================================================
export async function criarLancamentoManual(params: LancamentoManualParams) {
  const {
    empresaId,
    tipo,
    data,
    valor,
    descricao,
    contaBancariaId,
    categoriaId,
    centroCustoId,
    participante,
    formaPagamento,
    observacao,
    usuarioId,
  } = params;

  if (valor <= 0) throw new Error("Valor deve ser maior que zero");

  const [lanc] = await db
    .insert(lancamentosFinanceiros)
    .values({
      empresaId,
      tipo,
      data,
      valor: valor.toFixed(2),
      descricao,
      contaBancariaId,
      categoriaId: categoriaId || null,
      centroCustoId: centroCustoId || null,
      participante: participante || null,
      formaPagamento: formaPagamento || null,
      status: "CONFIRMADO",
      origem: "MANUAL",
      observacao: observacao || null,
      usuarioId: usuarioId || null,
    })
    .returning();

  return lanc;
}

// ============================================================
// TRANSFERÊNCIA ENTRE CONTAS
// ============================================================
export async function criarTransferencia(params: TransferenciaParams) {
  const {
    empresaId,
    data,
    valor,
    descricao,
    contaOrigemId,
    contaDestinoId,
    observacao,
    usuarioId,
  } = params;

  if (valor <= 0) throw new Error("Valor deve ser maior que zero");
  if (contaOrigemId === contaDestinoId) {
    throw new Error("Conta de origem e destino devem ser diferentes");
  }

  return await db.transaction(async (tx) => {
    const [origem] = await tx
      .select()
      .from(contasBancarias)
      .where(
        and(
          eq(contasBancarias.id, contaOrigemId),
          eq(contasBancarias.empresaId, empresaId)
        )
      );
    const [destino] = await tx
      .select()
      .from(contasBancarias)
      .where(
        and(
          eq(contasBancarias.id, contaDestinoId),
          eq(contasBancarias.empresaId, empresaId)
        )
      );

    if (!origem || !destino) throw new Error("Conta bancária não encontrada");

    const [lanc] = await tx
      .insert(lancamentosFinanceiros)
      .values({
        empresaId,
        tipo: "TRANSFERENCIA",
        data,
        valor: valor.toFixed(2),
        descricao: descricao || `Transferência ${origem.nome} → ${destino.nome}`,
        contaBancariaId: contaOrigemId,
        contaBancariaDestinoId: contaDestinoId,
        status: "CONFIRMADO",
        origem: "TRANSFERENCIA",
        observacao: observacao || null,
        usuarioId: usuarioId || null,
      })
      .returning();

    return lanc;
  });
}

// ============================================================
// RESUMO DE CONTAS A RECEBER / PAGAR
// ============================================================
export async function resumoContas(empresaId: number) {
  const [rec] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN status IN ('ABERTO','PARCIAL') THEN valor - COALESCE(valor_pago,0) ELSE 0 END),0)`,
      vencido: sql<string>`COALESCE(SUM(CASE WHEN status IN ('ABERTO','PARCIAL') AND vencimento < CURRENT_DATE THEN valor - COALESCE(valor_pago,0) ELSE 0 END),0)`,
      aVencer: sql<string>`COALESCE(SUM(CASE WHEN status IN ('ABERTO','PARCIAL') AND vencimento >= CURRENT_DATE THEN valor - COALESCE(valor_pago,0) ELSE 0 END),0)`,
      quantidade: sql<number>`COUNT(*) FILTER (WHERE status IN ('ABERTO','PARCIAL'))`,
    })
    .from(contasReceber)
    .where(eq(contasReceber.empresa_id, empresaId));

  const [pag] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN status IN ('ABERTO','PARCIAL') THEN valor - COALESCE(valor_pago,0) ELSE 0 END),0)`,
      vencido: sql<string>`COALESCE(SUM(CASE WHEN status IN ('ABERTO','PARCIAL') AND vencimento < CURRENT_DATE THEN valor - COALESCE(valor_pago,0) ELSE 0 END),0)`,
      aVencer: sql<string>`COALESCE(SUM(CASE WHEN status IN ('ABERTO','PARCIAL') AND vencimento >= CURRENT_DATE THEN valor - COALESCE(valor_pago,0) ELSE 0 END),0)`,
      quantidade: sql<number>`COUNT(*) FILTER (WHERE status IN ('ABERTO','PARCIAL'))`,
    })
    .from(contasPagar)
    .where(eq(contasPagar.empresa_id, empresaId));

  return {
    receber: {
      total: Number(rec?.total || 0),
      vencido: Number(rec?.vencido || 0),
      aVencer: Number(rec?.aVencer || 0),
      quantidade: Number(rec?.quantidade || 0),
    },
    pagar: {
      total: Number(pag?.total || 0),
      vencido: Number(pag?.vencido || 0),
      aVencer: Number(pag?.aVencer || 0),
      quantidade: Number(pag?.quantidade || 0),
    },
  };
}

// ============================================================
// FLUXO DE CAIXA COMPLETO (real + projetado)
// ============================================================
export async function fluxoCaixaCompleto(empresaId: number, meses = 6) {
  const hoje = new Date();
  const resultado: Array<{
    mes: string;
    ano: number;
    mesNumero: number;
    entradasConfirmadas: number;
    saidasConfirmadas: number;
    entradasProjetadas: number;
    saidasProjetadas: number;
    saldoInicial: number;
    saldoFinal: number;
  }> = [];

  // Saldo atual total
  const { total: saldoAtual } = await calcularSaldoTotal(empresaId);
  let saldoAcumulado = saldoAtual;

  for (let i = 0; i < meses; i++) {
    const dataRef = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const ano = dataRef.getFullYear();
    const mesNumero = dataRef.getMonth() + 1;
    const mesLabel = dataRef.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

    const inicio = `${ano}-${String(mesNumero).padStart(2, "0")}-01`;
    const fimDate = new Date(ano, mesNumero, 0);
    const fim = `${ano}-${String(mesNumero).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

    // Entradas confirmadas (lançamentos)
    const [entConf] = await db
      .select({
        total: sql<string>`COALESCE(SUM(valor),0)`,
      })
      .from(lancamentosFinanceiros)
      .where(
        and(
          eq(lancamentosFinanceiros.empresaId, empresaId),
          eq(lancamentosFinanceiros.status, "CONFIRMADO"),
          inArray(lancamentosFinanceiros.tipo, ["ENTRADA"]),
          gte(lancamentosFinanceiros.data, inicio),
          lte(lancamentosFinanceiros.data, fim)
        )
      );

    // Saídas confirmadas
    const [saiConf] = await db
      .select({
        total: sql<string>`COALESCE(SUM(valor),0)`,
      })
      .from(lancamentosFinanceiros)
      .where(
        and(
          eq(lancamentosFinanceiros.empresaId, empresaId),
          eq(lancamentosFinanceiros.status, "CONFIRMADO"),
          inArray(lancamentosFinanceiros.tipo, ["SAIDA"]),
          gte(lancamentosFinanceiros.data, inicio),
          lte(lancamentosFinanceiros.data, fim)
        )
      );

    // Transferências não alteram o total consolidado (só entre contas)

    // Projetado: contas a receber abertas com vencimento no mês
    const [entProj] = await db
      .select({
        total: sql<string>`COALESCE(SUM(valor - COALESCE(valor_pago,0)),0)`,
      })
      .from(contasReceber)
      .where(
        and(
          eq(contasReceber.empresa_id, empresaId),
          inArray(contasReceber.status, ["ABERTO", "PARCIAL"]),
          gte(contasReceber.vencimento, inicio),
          lte(contasReceber.vencimento, fim)
        )
      );

    // Projetado: contas a pagar
    const [saiProj] = await db
      .select({
        total: sql<string>`COALESCE(SUM(valor - COALESCE(valor_pago,0)),0)`,
      })
      .from(contasPagar)
      .where(
        and(
          eq(contasPagar.empresa_id, empresaId),
          inArray(contasPagar.status, ["ABERTO", "PARCIAL"]),
          gte(contasPagar.vencimento, inicio),
          lte(contasPagar.vencimento, fim)
        )
      );

    const entradasConfirmadas = Number(entConf?.total || 0);
    const saidasConfirmadas = Number(saiConf?.total || 0);
    const entradasProjetadas = Number(entProj?.total || 0);
    const saidasProjetadas = Number(saiProj?.total || 0);

    const saldoInicial = saldoAcumulado;
    const saldoFinal =
      saldoInicial +
      entradasConfirmadas -
      saidasConfirmadas +
      entradasProjetadas -
      saidasProjetadas;

    resultado.push({
      mes: mesLabel,
      ano,
      mesNumero,
      entradasConfirmadas,
      saidasConfirmadas,
      entradasProjetadas,
      saidasProjetadas,
      saldoInicial: Number(saldoInicial.toFixed(2)),
      saldoFinal: Number(saldoFinal.toFixed(2)),
    });

    saldoAcumulado = saldoFinal;
  }

  return resultado;
}

// ============================================================
// AGING (inadimplência)
// ============================================================
export async function agingReceber(empresaId: number) {
  const hoje = new Date().toISOString().slice(0, 10);

  const contas = await db
    .select()
    .from(contasReceber)
    .where(
      and(
        eq(contasReceber.empresa_id, empresaId),
        inArray(contasReceber.status, ["ABERTO", "PARCIAL"])
      )
    );

  const faixas = {
    aVencer: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const c of contas) {
    if (!c.vencimento) continue; // conta sem data de vencimento não entra no aging
    const saldo = Number(c.valor) - Number(c.valorPago || 0);
    const venc = new Date(c.vencimento);
    const hojeD = new Date(hoje);
    const diff = Math.floor((hojeD.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) faixas.aVencer += saldo;
    else if (diff <= 30) faixas["1-30"] += saldo;
    else if (diff <= 60) faixas["31-60"] += saldo;
    else if (diff <= 90) faixas["61-90"] += saldo;
    else faixas["90+"] += saldo;
  }

  return {
    aVencer: Number(faixas.aVencer.toFixed(2)),
    "1-30": Number(faixas["1-30"].toFixed(2)),
    "31-60": Number(faixas["31-60"].toFixed(2)),
    "61-90": Number(faixas["61-90"].toFixed(2)),
    "90+": Number(faixas["90+"].toFixed(2)),
    total:
      faixas.aVencer +
      faixas["1-30"] +
      faixas["31-60"] +
      faixas["61-90"] +
      faixas["90+"],
  };
}

export async function agingPagar(empresaId: number) {
  const hoje = new Date().toISOString().slice(0, 10);

  const contas = await db
    .select()
    .from(contasPagar)
    .where(
      and(
        eq(contasPagar.empresa_id, empresaId),
        inArray(contasPagar.status, ["ABERTO", "PARCIAL"])
      )
    );

  const faixas = {
    aVencer: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const c of contas) {
    if (!c.vencimento) continue; // conta sem data de vencimento não entra no aging
    const saldo = Number(c.valor) - Number(c.valorPago || 0);
    const venc = new Date(c.vencimento);
    const hojeD = new Date(hoje);
    const diff = Math.floor((hojeD.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) faixas.aVencer += saldo;
    else if (diff <= 30) faixas["1-30"] += saldo;
    else if (diff <= 60) faixas["31-60"] += saldo;
    else if (diff <= 90) faixas["61-90"] += saldo;
    else faixas["90+"] += saldo;
  }

  return {
    aVencer: Number(faixas.aVencer.toFixed(2)),
    "1-30": Number(faixas["1-30"].toFixed(2)),
    "31-60": Number(faixas["31-60"].toFixed(2)),
    "61-90": Number(faixas["61-90"].toFixed(2)),
    "90+": Number(faixas["90+"].toFixed(2)),
    total:
      faixas.aVencer +
      faixas["1-30"] +
      faixas["31-60"] +
      faixas["61-90"] +
      faixas["90+"],
  };
}

// ============================================================
// LISTAGENS COM FILTROS
// ============================================================
export async function listarContasReceber(
  empresaId: number,
  opts: {
    status?: string[];
    busca?: string;
    de?: string;
    ate?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const conditions = [eq(contasReceber.empresa_id, empresaId)];

  if (opts.status?.length) {
    conditions.push(inArray(contasReceber.status, opts.status));
  }
  if (opts.de) conditions.push(gte(contasReceber.vencimento, opts.de));
  if (opts.ate) conditions.push(lte(contasReceber.vencimento, opts.ate));
  if (opts.busca) {
    conditions.push(
      or(
        sql`${contasReceber.participante} ILIKE ${"%" + opts.busca + "%"}`,
        sql`${contasReceber.descricao} ILIKE ${"%" + opts.busca + "%"}`
      )!
    );
  }

  const rows = await db
    .select()
    .from(contasReceber)
    .where(and(...conditions))
    .orderBy(desc(contasReceber.vencimento))
    .limit(opts.limit || 200)
    .offset(opts.offset || 0);

  return rows;
}

export async function listarContasPagar(
  empresaId: number,
  opts: {
    status?: string[];
    busca?: string;
    de?: string;
    ate?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const conditions = [eq(contasPagar.empresa_id, empresaId)];

  if (opts.status?.length) {
    conditions.push(inArray(contasPagar.status, opts.status));
  }
  if (opts.de) conditions.push(gte(contasPagar.vencimento, opts.de));
  if (opts.ate) conditions.push(lte(contasPagar.vencimento, opts.ate));
  if (opts.busca) {
    conditions.push(
      or(
        sql`${contasPagar.participante} ILIKE ${"%" + opts.busca + "%"}`,
        sql`${contasPagar.descricao} ILIKE ${"%" + opts.busca + "%"}`
      )!
    );
  }

  const rows = await db
    .select()
    .from(contasPagar)
    .where(and(...conditions))
    .orderBy(desc(contasPagar.vencimento))
    .limit(opts.limit || 200)
    .offset(opts.offset || 0);

  return rows;
}

// ============================================================
// CATEGORIAS PADRÃO BRASILEIRAS (seed)
// ============================================================
export const CATEGORIAS_PADRAO = [
  // RECEITAS
  { nome: "Vendas de Mercadorias", tipo: "RECEITA", cor: "#10B981" },
  { nome: "Prestação de Serviços", tipo: "RECEITA", cor: "#10B981" },
  { nome: "Receitas Financeiras", tipo: "RECEITA", cor: "#34D399" },
  { nome: "Outras Receitas", tipo: "RECEITA", cor: "#6EE7B7" },
  // DESPESAS
  { nome: "Fornecedores / Insumos", tipo: "DESPESA", cor: "#EF4444" },
  { nome: "Salários e Encargos", tipo: "DESPESA", cor: "#F87171" },
  { nome: "Aluguel", tipo: "DESPESA", cor: "#F97316" },
  { nome: "Energia / Água / Internet", tipo: "DESPESA", cor: "#FB923C" },
  { nome: "Impostos e Taxas", tipo: "DESPESA", cor: "#F59E0B" },
  { nome: "Marketing e Publicidade", tipo: "DESPESA", cor: "#EAB308" },
  { nome: "Despesas Bancárias", tipo: "DESPESA", cor: "#84CC16" },
  { nome: "Manutenção e Reparos", tipo: "DESPESA", cor: "#22C55E" },
  { nome: "Transporte e Frete", tipo: "DESPESA", cor: "#14B8A6" },
  { nome: "Material de Escritório", tipo: "DESPESA", cor: "#06B6D4" },
  { nome: "Outras Despesas", tipo: "DESPESA", cor: "#64748B" },
];

export async function seedCategoriasPadrao(empresaId: number) {
  const existentes = await db
    .select()
    .from(categoriasFinanceiras)
    .where(eq(categoriasFinanceiras.empresaId, empresaId));

  if (existentes.length > 0) return existentes;

  const inserted = await db
    .insert(categoriasFinanceiras)
    .values(
      CATEGORIAS_PADRAO.map((c) => ({
        empresaId,
        nome: c.nome,
        tipo: c.tipo,
        cor: c.cor,
        ativo: true,
      }))
    )
    .returning();

  return inserted;
}

// ============================================================
// CONCILIAÇÃO — IMPORTAÇÃO DE EXTRATO (OFX/CSV)
// ============================================================
export interface LinhaExtrato {
  data: string;
  descricao: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  documento?: string;
}

export async function importarExtrato(params: {
  empresaId: number;
  contaBancariaId: number;
  linhas: LinhaExtrato[];
}) {
  const { empresaId, contaBancariaId, linhas } = params;

  let importadas = 0;
  let duplicadas = 0;
  const erros: string[] = [];

  for (const linha of linhas) {
    try {
      // Hash pra não importar a mesma linha duas vezes se o extrato for reenviado
      const hash = createHash("sha256")
        .update(`${empresaId}|${contaBancariaId}|${linha.data}|${linha.valor}|${linha.descricao}`)
        .digest("hex");

      const [existente] = await db
        .select({ id: extratosBancarios.id })
        .from(extratosBancarios)
        .where(
          and(eq(extratosBancarios.empresaId, empresaId), eq(extratosBancarios.hash, hash))
        );

      if (existente) {
        duplicadas++;
        continue;
      }

      await db.insert(extratosBancarios).values({
        empresaId,
        contaBancariaId,
        data: linha.data,
        descricao: linha.descricao,
        valor: String(linha.valor),
        tipo: linha.tipo,
        documento: linha.documento || null,
        hash,
        conciliado: false,
      });

      importadas++;
    } catch (e: any) {
      erros.push(`Linha "${linha.descricao}": ${e.message || "erro desconhecido"}`);
    }
  }

  return { importadas, duplicadas, erros, total: linhas.length };
}
