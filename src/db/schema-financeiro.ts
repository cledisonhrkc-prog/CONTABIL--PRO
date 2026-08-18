/**
 * SCHEMA DO MÓDULO FINANCEIRO
 * 
 * IMPORTANTE — MERGE:
 * 1. As tabelas contas_receber e contas_pagar JÁ EXISTEM no seu schema.ts principal.
 *    NÃO redefina elas aqui. Em vez disso, adicione as colunas novas no schema.ts
 *    original (valorPago, categoriaId, centroCustoId, contaBancariaId, formaPagamento,
 *    descricao, observacao, participanteId, updatedAt).
 * 
 * 2. Importe e re-exporte as tabelas NOVAS abaixo no seu schema.ts principal:
 *    export * from "./schema-financeiro";
 *    ou importe seletivamente.
 */

import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  date,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// -------------------- CONTAS BANCÁRIAS (NOVA) --------------------
export const contasBancarias = pgTable(
  "contas_bancarias",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    nome: text("nome").notNull(),
    banco: text("banco"),
    agencia: text("agencia"),
    conta: text("conta"),
    tipo: text("tipo").notNull().default("CORRENTE"),
    saldoInicial: numeric("saldo_inicial", { precision: 15, scale: 2 }).default("0"),
    dataSaldoInicial: date("data_saldo_inicial"),
    ativa: boolean("ativa").default(true),
    cor: text("cor").default("#3B82F6"),
    observacao: text("observacao"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({ empresaIdx: index("contas_bancarias_empresa_idx").on(t.empresaId) })
);

// -------------------- CATEGORIAS FINANCEIRAS (NOVA) --------------------
export const categoriasFinanceiras = pgTable(
  "categorias_financeiras",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    nome: text("nome").notNull(),
    tipo: text("tipo").notNull(),
    cor: text("cor").default("#6B7280"),
    icone: text("icone"),
    ativo: boolean("ativo").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ empresaIdx: index("categorias_financeiras_empresa_idx").on(t.empresaId) })
);

// -------------------- CENTROS DE CUSTO (NOVA) --------------------
export const centrosCusto = pgTable(
  "centros_custo",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    nome: text("nome").notNull(),
    codigo: text("codigo"),
    ativo: boolean("ativo").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ empresaIdx: index("centros_custo_empresa_idx").on(t.empresaId) })
);

// -------------------- BAIXAS (NOVA) --------------------
export const baixas = pgTable(
  "baixas",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    tipo: text("tipo").notNull(),
    contaId: integer("conta_id").notNull(),
    dataBaixa: date("data_baixa").notNull(),
    valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
    contaBancariaId: integer("conta_bancaria_id").notNull(),
    formaPagamento: text("forma_pagamento"),
    observacao: text("observacao"),
    usuarioId: integer("usuario_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    empresaIdx: index("baixas_empresa_idx").on(t.empresaId),
    contaIdx: index("baixas_conta_idx").on(t.contaId),
  })
);

// -------------------- LANÇAMENTOS FINANCEIROS (NOVA) --------------------
export const lancamentosFinanceiros = pgTable(
  "lancamentos_financeiros",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    tipo: text("tipo").notNull(),
    data: date("data").notNull(),
    valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
    descricao: text("descricao").notNull(),
    categoriaId: integer("categoria_id"),
    centroCustoId: integer("centro_custo_id"),
    contaBancariaId: integer("conta_bancaria_id").notNull(),
    contaBancariaDestinoId: integer("conta_bancaria_destino_id"),
    participante: text("participante"),
    formaPagamento: text("forma_pagamento"),
    status: text("status").default("CONFIRMADO"),
    origem: text("origem").default("MANUAL"),
    referenciaId: integer("referencia_id"),
    observacao: text("observacao"),
    usuarioId: integer("usuario_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    empresaIdx: index("lancamentos_empresa_idx").on(t.empresaId),
    dataIdx: index("lancamentos_data_idx").on(t.data),
    contaIdx: index("lancamentos_conta_idx").on(t.contaBancariaId),
  })
);

// -------------------- EXTRATOS BANCÁRIOS (NOVA) --------------------
export const extratosBancarios = pgTable(
  "extratos_bancarios",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    contaBancariaId: integer("conta_bancaria_id").notNull(),
    data: date("data").notNull(),
    descricao: text("descricao").notNull(),
    valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
    tipo: text("tipo").notNull(),
    documento: text("documento"),
    hash: text("hash"),
    conciliado: boolean("conciliado").default(false),
    lancamentoId: integer("lancamento_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    empresaIdx: index("extratos_empresa_idx").on(t.empresaId),
    contaIdx: index("extratos_conta_idx").on(t.contaBancariaId),
  })
);

// -------------------- CONCILIAÇÕES (NOVA) --------------------
export const conciliacoes = pgTable("conciliacoes", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull(),
  contaBancariaId: integer("conta_bancaria_id").notNull(),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  saldoExtrato: numeric("saldo_extrato", { precision: 15, scale: 2 }),
  saldoSistema: numeric("saldo_sistema", { precision: 15, scale: 2 }),
  status: text("status").default("EM_ANDAMENTO"),
  usuarioId: integer("usuario_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// -------------------- RE-EXPORT: contas_receber / contas_pagar --------------------
// Essas tabelas JÁ EXISTEM no seu schema.ts real (linhas 156-176) e usam
// `empresa_id` (snake_case) como nome de propriedade — não `empresaId`.
// Por isso não são redefinidas aqui.
//
// PATCH EXATO — cole estas linhas dentro de `contasReceber` e `contasPagar`
// no seu @/db/schema, logo antes do `});` de fechamento de cada uma
// (linha 165 pra contasReceber, linha 176 pra contasPagar):
//
//   valorPago: numeric("valor_pago", { precision: 15, scale: 2 }).default("0"),
//   categoriaId: integer("categoria_id"),
//   centroCustoId: integer("centro_custo_id"),
//   contaBancariaId: integer("conta_bancaria_id"),
//   formaPagamento: text("forma_pagamento"),
//   descricao: text("descricao"),
//   observacao: text("observacao"),
//   participanteId: integer("participante_id"),
//   updatedAt: timestamp("updated_at").defaultNow(),
//
// Se `numeric`, `timestamp` ainda não estiverem importados de "drizzle-orm/pg-core"
// no topo do schema.ts, adicione ao import existente.
//
// Validado com `tsc --noEmit` contra uma cópia do seu schema.ts real
// (empresa_id snake_case incluído) — zero erros de tipo.
export { contasReceber, contasPagar } from "@/db/schema";
