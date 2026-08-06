import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------- Empresas ----------------
export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  cnpj: varchar("cnpj", { length: 20 }).notNull().unique(),
  nome: text("nome").notNull(),
  regime: varchar("regime", { length: 20 }).notNull().default("SIMPLES"), // SIMPLES | LUCRO_PRESUMIDO | LUCRO_REAL
  anexo_simples: varchar("anexo_simples", { length: 4 }).default("I"), // Anexo I..V
  segmento: varchar("segmento", { length: 40 }).default("COMERCIO"),
  rbt12: numeric("rbt12", { precision: 18, scale: 2 }).default("0"),
  cmv_percent: numeric("cmv_percent", { precision: 6, scale: 4 }).default("0.6000"),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------- Plano de Contas ----------------
export const planoContas = pgTable("plano_contas", {
  codigo: varchar("codigo", { length: 20 }).primaryKey(),
  descricao: text("descricao").notNull(),
  tipo: varchar("tipo", { length: 32 }).notNull(), // ATIVO | PASSIVO | PATRIMONIO_LIQUIDO | RECEITA | CUSTO | DESPESA | RESULTADO
  natureza: varchar("natureza", { length: 12 }).notNull(), // DEVEDORA | CREDITORA
  nivel: integer("nivel").notNull(),
  conta_pai: varchar("conta_pai", { length: 20 }),
});

// ---------------- Notas Fiscais ----------------
export const notasFiscais = pgTable(
  "notas_fiscais",
  {
    id: serial("id").primaryKey(),
    empresa_id: integer("empresa_id").notNull(),
    chave: varchar("chave", { length: 60 }),
    numero: varchar("numero", { length: 20 }),
    serie: varchar("serie", { length: 10 }),
    modelo: varchar("modelo", { length: 5 }),
    tipo_operacao: varchar("tipo_operacao", { length: 10 }),
    finalidade: varchar("finalidade", { length: 15 }),
    data_emissao: date("data_emissao"),
    participante: text("participante"),
    cnpj_part: varchar("cnpj_part", { length: 20 }),
    valor_produtos: numeric("valor_produtos", { precision: 18, scale: 2 }).default("0"),
    valor_frete: numeric("valor_frete", { precision: 18, scale: 2 }).default("0"),
    valor_seguro: numeric("valor_seguro", { precision: 18, scale: 2 }).default("0"),
    valor_desconto: numeric("valor_desconto", { precision: 18, scale: 2 }).default("0"),
    valor_outras: numeric("valor_outras", { precision: 18, scale: 2 }).default("0"),
    valor_total: numeric("valor_total", { precision: 18, scale: 2 }).default("0"),
    valor_icms: numeric("valor_icms", { precision: 18, scale: 2 }).default("0"),
    valor_icms_st: numeric("valor_icms_st", { precision: 18, scale: 2 }).default("0"),
    valor_ipi: numeric("valor_ipi", { precision: 18, scale: 2 }).default("0"),
    valor_pis: numeric("valor_pis", { precision: 18, scale: 2 }).default("0"),
    valor_cofins: numeric("valor_cofins", { precision: 18, scale: 2 }).default("0"),
    valor_iss: numeric("valor_iss", { precision: 18, scale: 2 }).default("0"),
    created_at: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    // Dedup HARD no banco: mesma chave para mesma empresa NUNCA duplica
    unqEmpresaChave: uniqueIndex("unq_nf_empresa_chave").on(t.empresa_id, t.chave),
  })
);

// ---------------- Itens NF ----------------
export const itensNf = pgTable("itens_nf", {
  id: serial("id").primaryKey(),
  id_nf: integer("id_nf").notNull(),
  cprod: varchar("cprod", { length: 40 }),
  xprod: text("xprod"),
  ncm: varchar("ncm", { length: 15 }),
  cfop: varchar("cfop", { length: 8 }),
  quantidade: numeric("quantidade", { precision: 18, scale: 4 }).default("0"),
  valor_unitario: numeric("valor_unitario", { precision: 18, scale: 6 }).default("0"),
  valor_total: numeric("valor_total", { precision: 18, scale: 2 }).default("0"),
  cst_pis: varchar("cst_pis", { length: 4 }),
  cst_cof: varchar("cst_cof", { length: 4 }),
});

// ---------------- Lançamentos (partidas dobradas) ----------------
export const lancamentos = pgTable("lancamentos", {
  id: serial("id").primaryKey(),
  empresa_id: integer("empresa_id").notNull(),
  numero: varchar("numero", { length: 20 }).notNull().unique(),
  data: date("data").notNull(),
  competencia: date("competencia").notNull(),
  exercicio: integer("exercicio").notNull(),
  historico: text("historico"),
  id_nf: integer("id_nf"),
  origem: varchar("origem", { length: 20 }).default("FISCAL"),
  tipo_lanc: varchar("tipo_lanc", { length: 20 }).default("NORMAL"),
  valor_total: numeric("valor_total", { precision: 18, scale: 2 }).default("0"),
});

export const lancamentoItens = pgTable("lancamento_itens", {
  id: serial("id").primaryKey(),
  id_lanc: integer("id_lanc").notNull(),
  codigo_conta: varchar("codigo_conta", { length: 20 }).notNull(),
  debito: numeric("debito", { precision: 18, scale: 2 }).default("0"),
  credito: numeric("credito", { precision: 18, scale: 2 }).default("0"),
});

// ---------------- Apuração de Impostos ----------------
export const apuracaoImpostos = pgTable("apuracao_impostos", {
  id: serial("id").primaryKey(),
  empresa_id: integer("empresa_id").notNull(),
  periodo: varchar("periodo", { length: 10 }).notNull(), // YYYY ou YYYY-MM
  imposto: varchar("imposto", { length: 20 }).notNull(),
  debito: numeric("debito", { precision: 18, scale: 2 }).default("0"),
  credito: numeric("credito", { precision: 18, scale: 2 }).default("0"),
  apurado: numeric("apurado", { precision: 18, scale: 2 }).default("0"),
  a_pagar: numeric("a_pagar", { precision: 18, scale: 2 }).default("0"),
});

// ---------------- Exercícios ----------------
export const exercicios = pgTable(
  "exercicios",
  {
    id: serial("id").primaryKey(),
    empresa_id: integer("empresa_id").notNull(),
    ano: integer("ano").notNull(),
    status: varchar("status", { length: 20 }).default("ABERTO"),
    resultado: numeric("resultado", { precision: 18, scale: 2 }).default("0"),
  },
  (t) => ({
    unqEmpresaAno: uniqueIndex("unq_exercicios_empresa_ano").on(t.empresa_id, t.ano),
  })
);

// ---------------- Auditoria (R08 monofásico e outras) ----------------
export const auditoria = pgTable("auditoria", {
  id: serial("id").primaryKey(),
  empresa_id: integer("empresa_id").notNull(),
  id_nf: integer("id_nf"),
  numero_nf: varchar("numero_nf", { length: 20 }),
  regra: varchar("regra", { length: 20 }),
  tipo: varchar("tipo", { length: 20 }),
  ncm: varchar("ncm", { length: 15 }),
  cst_pis: varchar("cst_pis", { length: 4 }),
  cst_cof: varchar("cst_cof", { length: 4 }),
  descricao: text("descricao"),
  valor_nota: numeric("valor_nota", { precision: 18, scale: 2 }).default("0"),
  valor_credito: numeric("valor_credito", { precision: 18, scale: 2 }).default("0"),
  regime: varchar("regime", { length: 20 }),
  acao: text("acao"),
});

// ---------------- Contas a Receber / Pagar ----------------
export const contasReceber = pgTable("contas_receber", {
  id: serial("id").primaryKey(),
  empresa_id: integer("empresa_id").notNull(),
  id_nf: integer("id_nf"),
  participante: text("participante"),
  emissao: date("emissao"),
  vencimento: date("vencimento"),
  valor: numeric("valor", { precision: 18, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("ABERTO"),
});

export const contasPagar = pgTable("contas_pagar", {
  id: serial("id").primaryKey(),
  empresa_id: integer("empresa_id").notNull(),
  id_nf: integer("id_nf"),
  participante: text("participante"),
  emissao: date("emissao"),
  vencimento: date("vencimento"),
  valor: numeric("valor", { precision: 18, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("ABERTO"),
});

// ---------------- Bancos ----------------
export const bancos = pgTable("bancos", {
  id: serial("id").primaryKey(),
  empresa_id: integer("empresa_id").notNull(),
  nome: text("nome").notNull(),
  agencia: varchar("agencia", { length: 20 }),
  conta: varchar("conta", { length: 30 }),
  saldo: numeric("saldo", { precision: 18, scale: 2 }).default("0"),
});
