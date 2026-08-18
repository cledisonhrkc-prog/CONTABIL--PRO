import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Rota de setup único do módulo financeiro — aplica a migration
 * (migrations/001_financeiro_completo.sql) direto no banco Neon de produção.
 *
 * Só admin pode chamar. Idempotente: pode rodar mais de uma vez sem
 * duplicar nada (tudo usa IF NOT EXISTS / WHERE NOT EXISTS).
 *
 * Uso (uma vez só, logado como admin no navegador):
 *   GET https://contabil-pro-wheat.vercel.app/api/financeiro/setup
 */

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS contas_bancarias (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    tipo TEXT NOT NULL DEFAULT 'CORRENTE',
    saldo_inicial NUMERIC(15,2) DEFAULT 0,
    data_saldo_inicial DATE,
    ativa BOOLEAN DEFAULT TRUE,
    cor TEXT DEFAULT '#3B82F6',
    observacao TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS contas_bancarias_empresa_idx ON contas_bancarias(empresa_id)`,

  `CREATE TABLE IF NOT EXISTS categorias_financeiras (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    cor TEXT DEFAULT '#6B7280',
    icone TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS categorias_financeiras_empresa_idx ON categorias_financeiras(empresa_id)`,

  `CREATE TABLE IF NOT EXISTS centros_custo (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    codigo TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS centros_custo_empresa_idx ON centros_custo(empresa_id)`,

  `CREATE TABLE IF NOT EXISTS baixas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    conta_id INTEGER NOT NULL,
    data_baixa DATE NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    conta_bancaria_id INTEGER NOT NULL,
    forma_pagamento TEXT,
    observacao TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS baixas_empresa_idx ON baixas(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS baixas_conta_idx ON baixas(conta_id)`,

  `CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    data DATE NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    descricao TEXT NOT NULL,
    categoria_id INTEGER,
    centro_custo_id INTEGER,
    conta_bancaria_id INTEGER NOT NULL,
    conta_bancaria_destino_id INTEGER,
    participante TEXT,
    forma_pagamento TEXT,
    status TEXT DEFAULT 'CONFIRMADO',
    origem TEXT DEFAULT 'MANUAL',
    referencia_id INTEGER,
    observacao TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS lancamentos_empresa_idx ON lancamentos_financeiros(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS lancamentos_data_idx ON lancamentos_financeiros(data)`,
  `CREATE INDEX IF NOT EXISTS lancamentos_conta_idx ON lancamentos_financeiros(conta_bancaria_id)`,

  `CREATE TABLE IF NOT EXISTS extratos_bancarios (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    conta_bancaria_id INTEGER NOT NULL,
    data DATE NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    tipo TEXT NOT NULL,
    documento TEXT,
    hash TEXT,
    conciliado BOOLEAN DEFAULT FALSE,
    lancamento_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS extratos_empresa_idx ON extratos_bancarios(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS extratos_conta_idx ON extratos_bancarios(conta_bancaria_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS extratos_hash_idx ON extratos_bancarios(empresa_id, hash)`,

  `CREATE TABLE IF NOT EXISTS conciliacoes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    conta_bancaria_id INTEGER NOT NULL,
    data_inicio DATE,
    data_fim DATE,
    saldo_extrato NUMERIC(15,2),
    saldo_sistema NUMERIC(15,2),
    status TEXT DEFAULT 'EM_ANDAMENTO',
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(15,2) DEFAULT 0`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS categoria_id INTEGER`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS centro_custo_id INTEGER`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS conta_bancaria_id INTEGER`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS forma_pagamento TEXT`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS descricao TEXT`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS observacao TEXT`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS participante_id INTEGER`,
  `ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,

  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(15,2) DEFAULT 0`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS categoria_id INTEGER`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS centro_custo_id INTEGER`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS conta_bancaria_id INTEGER`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS forma_pagamento TEXT`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS descricao TEXT`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS observacao TEXT`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS participante_id INTEGER`,
  `ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
];

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json(
      { error: "Só admin pode rodar o setup do financeiro." },
      { status: 403 }
    );
  }

  const executados: string[] = [];
  const erros: { statement: string; erro: string }[] = [];

  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
      executados.push(stmt.trim().split("\n")[0].slice(0, 80));
    } catch (e: any) {
      erros.push({ statement: stmt.trim().split("\n")[0].slice(0, 80), erro: e.message });
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    total: STATEMENTS.length,
    executados: executados.length,
    erros,
  });
}
