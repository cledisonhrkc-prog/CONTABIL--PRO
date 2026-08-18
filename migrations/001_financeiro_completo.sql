-- ============================================================
-- MIGRATION COMPLETA — MÓDULO FINANCEIRO CONTÁBIL PRO
-- Execute uma única vez. Nada ficou de fora.
-- ============================================================

-- 1. CONTAS BANCÁRIAS
CREATE TABLE IF NOT EXISTS contas_bancarias (
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
);
CREATE INDEX IF NOT EXISTS contas_bancarias_empresa_idx ON contas_bancarias(empresa_id);

-- 2. CATEGORIAS FINANCEIRAS
CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  cor TEXT DEFAULT '#6B7280',
  icone TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS categorias_financeiras_empresa_idx ON categorias_financeiras(empresa_id);

-- 3. CENTROS DE CUSTO
CREATE TABLE IF NOT EXISTS centros_custo (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  codigo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS centros_custo_empresa_idx ON centros_custo(empresa_id);

-- 4. BAIXAS
CREATE TABLE IF NOT EXISTS baixas (
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
);
CREATE INDEX IF NOT EXISTS baixas_empresa_idx ON baixas(empresa_id);
CREATE INDEX IF NOT EXISTS baixas_conta_idx ON baixas(conta_id);

-- 5. LANÇAMENTOS FINANCEIROS
CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
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
);
CREATE INDEX IF NOT EXISTS lancamentos_empresa_idx ON lancamentos_financeiros(empresa_id);
CREATE INDEX IF NOT EXISTS lancamentos_data_idx ON lancamentos_financeiros(data);
CREATE INDEX IF NOT EXISTS lancamentos_conta_idx ON lancamentos_financeiros(conta_bancaria_id);

-- 6. EXTRATOS BANCÁRIOS
CREATE TABLE IF NOT EXISTS extratos_bancarios (
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
);
CREATE INDEX IF NOT EXISTS extratos_empresa_idx ON extratos_bancarios(empresa_id);
CREATE INDEX IF NOT EXISTS extratos_conta_idx ON extratos_bancarios(conta_bancaria_id);
CREATE UNIQUE INDEX IF NOT EXISTS extratos_hash_idx ON extratos_bancarios(empresa_id, hash);

-- 7. CONCILIAÇÕES
CREATE TABLE IF NOT EXISTS conciliacoes (
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
);

-- 8. ALTERS REAIS nas tabelas que JÁ EXISTEM
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(15,2) DEFAULT 0;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS categoria_id INTEGER;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS centro_custo_id INTEGER;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS conta_bancaria_id INTEGER;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS participante_id INTEGER;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(15,2) DEFAULT 0;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS categoria_id INTEGER;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS centro_custo_id INTEGER;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS conta_bancaria_id INTEGER;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS participante_id INTEGER;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 9. CATEGORIAS PADRÃO empresa 24
INSERT INTO categorias_financeiras (empresa_id, nome, tipo, cor)
SELECT 24, v.nome, v.tipo, v.cor
FROM (VALUES
  ('Vendas de Produtos', 'RECEITA', '#10B981'),
  ('Prestação de Serviços', 'RECEITA', '#059669'),
  ('Outras Receitas', 'RECEITA', '#34D399'),
  ('Fornecedores / Insumos', 'DESPESA', '#EF4444'),
  ('Aluguel', 'DESPESA', '#DC2626'),
  ('Salários e Encargos', 'DESPESA', '#B91C1C'),
  ('Impostos e Taxas', 'DESPESA', '#F97316'),
  ('Energia / Água / Internet', 'DESPESA', '#EA580C'),
  ('Marketing e Publicidade', 'DESPESA', '#C2410C'),
  ('Taxas Bancárias', 'DESPESA', '#9A3412'),
  ('Manutenção', 'DESPESA', '#7C2D12'),
  ('Outras Despesas', 'DESPESA', '#6B7280')
) AS v(nome, tipo, cor)
WHERE NOT EXISTS (
  SELECT 1 FROM categorias_financeiras c WHERE c.empresa_id = 24 AND c.nome = v.nome
);

-- 10. CATEGORIAS PADRÃO empresa 25
INSERT INTO categorias_financeiras (empresa_id, nome, tipo, cor)
SELECT 25, v.nome, v.tipo, v.cor
FROM (VALUES
  ('Vendas de Produtos', 'RECEITA', '#10B981'),
  ('Prestação de Serviços', 'RECEITA', '#059669'),
  ('Outras Receitas', 'RECEITA', '#34D399'),
  ('Fornecedores / Insumos', 'DESPESA', '#EF4444'),
  ('Aluguel', 'DESPESA', '#DC2626'),
  ('Salários e Encargos', 'DESPESA', '#B91C1C'),
  ('Impostos e Taxas', 'DESPESA', '#F97316'),
  ('Energia / Água / Internet', 'DESPESA', '#EA580C'),
  ('Marketing e Publicidade', 'DESPESA', '#C2410C'),
  ('Taxas Bancárias', 'DESPESA', '#9A3412'),
  ('Manutenção', 'DESPESA', '#7C2D12'),
  ('Outras Despesas', 'DESPESA', '#6B7280')
) AS v(nome, tipo, cor)
WHERE NOT EXISTS (
  SELECT 1 FROM categorias_financeiras c WHERE c.empresa_id = 25 AND c.nome = v.nome
);
