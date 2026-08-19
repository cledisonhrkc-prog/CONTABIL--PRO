import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Rota de setup único do módulo DP (Escopo A: cadastro + pró-labore).
 * Aplica migrations/001_dp_escopo_a.sql direto no banco Neon de produção.
 *
 * Só admin pode chamar. Idempotente: pode rodar mais de uma vez sem
 * duplicar nada — validado localmente contra Postgres real, rodando
 * 2x seguidas sem erro nem duplicação.
 *
 * Inclui trigger de isolamento por empresa: bloqueia qualquer INSERT/UPDATE
 * em colaborador_vinculos ou pro_labore_pagamentos cujo empresa_id não bata
 * com o empresa_id real do colaborador — testado e confirmado bloqueando.
 *
 * Uso (uma vez só, logado como admin no navegador):
 *   GET https://contabil-pro-wheat.vercel.app/api/dp/setup
 */

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS colaboradores (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo_pessoa         VARCHAR(20) NOT NULL DEFAULT 'FUNCIONARIO'
                        CHECK (tipo_pessoa IN ('FUNCIONARIO', 'SOCIO', 'ESTAGIARIO', 'AUTONOMO')),
    cpf                 CHAR(11) NOT NULL,
    nome_completo       VARCHAR(255) NOT NULL,
    nome_social         VARCHAR(255),
    data_nascimento     DATE,
    genero              VARCHAR(20),
    estado_civil        VARCHAR(30),
    email               VARCHAR(255),
    telefone            VARCHAR(20),
    pis_pasep           CHAR(11),
    ctps_numero         VARCHAR(20),
    ctps_serie          VARCHAR(10),
    ctps_uf             CHAR(2),
    rg_numero           VARCHAR(20),
    rg_orgao_emissor    VARCHAR(15),
    rg_uf               CHAR(2),
    is_ativo            BOOLEAN NOT NULL DEFAULT TRUE,
    observacoes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_colaboradores_empresa_cpf UNIQUE (empresa_id, cpf)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa ON colaboradores(empresa_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_colaboradores_tipo ON colaboradores(empresa_id, tipo_pessoa) WHERE deleted_at IS NULL`,

  `CREATE TABLE IF NOT EXISTS colaborador_enderecos (
    id                  SERIAL PRIMARY KEY,
    colaborador_id      INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    cep                 CHAR(8),
    logradouro          VARCHAR(255),
    numero              VARCHAR(20),
    complemento         VARCHAR(100),
    bairro              VARCHAR(100),
    cidade              VARCHAR(100),
    uf                  CHAR(2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_colaborador_endereco UNIQUE (colaborador_id)
  )`,

  `CREATE TABLE IF NOT EXISTS colaborador_contas_bancarias (
    id                  SERIAL PRIMARY KEY,
    colaborador_id      INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    banco_codigo        VARCHAR(5) NOT NULL,
    banco_nome          VARCHAR(100),
    agencia             VARCHAR(10) NOT NULL,
    conta               VARCHAR(20) NOT NULL,
    digito              VARCHAR(2),
    tipo_conta          VARCHAR(20) DEFAULT 'CORRENTE'
                        CHECK (tipo_conta IN ('CORRENTE', 'POUPANCA', 'PAGAMENTO')),
    is_principal        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_colaborador_contas ON colaborador_contas_bancarias(colaborador_id)`,

  `CREATE TABLE IF NOT EXISTS colaborador_dependentes (
    id                  SERIAL PRIMARY KEY,
    colaborador_id      INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    nome_completo       VARCHAR(255) NOT NULL,
    cpf                 CHAR(11),
    data_nascimento     DATE,
    parentesco          VARCHAR(30) NOT NULL
                        CHECK (parentesco IN ('CONJUGE', 'FILHO', 'ENTEADO', 'PAI', 'MAE', 'OUTRO')),
    is_dependente_irrf  BOOLEAN NOT NULL DEFAULT FALSE,
    is_salario_familia  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dependentes_colaborador ON colaborador_dependentes(colaborador_id)`,

  `CREATE TABLE IF NOT EXISTS colaborador_vinculos (
    id                      SERIAL PRIMARY KEY,
    empresa_id              INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    colaborador_id          INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    tipo_vinculo            VARCHAR(30) NOT NULL
                            CHECK (tipo_vinculo IN ('CLT', 'PRO_LABORE', 'ESTAGIO', 'AUTONOMO', 'TEMPORARIO')),
    cargo                   VARCHAR(150),
    data_admissao           DATE NOT NULL,
    data_demissao           DATE,
    salario_base            NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_pro_labore        NUMERIC(15,2),
    carga_horaria_semanal   NUMERIC(5,2),
    is_ativo                BOOLEAN NOT NULL DEFAULT TRUE,
    observacoes             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vinculos_empresa ON colaborador_vinculos(empresa_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_vinculos_colaborador ON colaborador_vinculos(colaborador_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_vinculos_tipo ON colaborador_vinculos(empresa_id, tipo_vinculo) WHERE deleted_at IS NULL`,

  `CREATE TABLE IF NOT EXISTS pro_labore_pagamentos (
    id                  SERIAL PRIMARY KEY,
    empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    vinculo_id          INTEGER NOT NULL REFERENCES colaborador_vinculos(id) ON DELETE CASCADE,
    colaborador_id      INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    competencia         CHAR(7) NOT NULL,
    valor_bruto         NUMERIC(15,2) NOT NULL,
    valor_inss          NUMERIC(15,2) DEFAULT 0,
    valor_irrf          NUMERIC(15,2) DEFAULT 0,
    valor_liquido       NUMERIC(15,2) NOT NULL,
    data_pagamento      DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
                        CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    observacoes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prolabore_competencia UNIQUE (vinculo_id, competencia)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_prolabore_empresa ON pro_labore_pagamentos(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prolabore_competencia ON pro_labore_pagamentos(empresa_id, competencia)`,
  `CREATE INDEX IF NOT EXISTS idx_prolabore_colaborador ON pro_labore_pagamentos(colaborador_id)`,

  `CREATE OR REPLACE FUNCTION atualizar_updated_at()
  RETURNS TRIGGER AS $BODY$
  BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
  END;
  $BODY$ LANGUAGE plpgsql`,

  `DO $BODY$
  BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_colaboradores_updated_at') THEN
          CREATE TRIGGER trg_colaboradores_updated_at
          BEFORE UPDATE ON colaboradores
          FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vinculos_updated_at') THEN
          CREATE TRIGGER trg_vinculos_updated_at
          BEFORE UPDATE ON colaborador_vinculos
          FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prolabore_updated_at') THEN
          CREATE TRIGGER trg_prolabore_updated_at
          BEFORE UPDATE ON pro_labore_pagamentos
          FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
      END IF;
  END $BODY$`,

  `CREATE OR REPLACE FUNCTION dp_validar_empresa_colaborador()
  RETURNS TRIGGER AS $BODY$
  DECLARE
      v_empresa_real INTEGER;
  BEGIN
      SELECT empresa_id INTO v_empresa_real FROM colaboradores WHERE id = NEW.colaborador_id;

      IF v_empresa_real IS NULL THEN
          RAISE EXCEPTION 'Colaborador % não existe', NEW.colaborador_id;
      END IF;

      IF v_empresa_real <> NEW.empresa_id THEN
          RAISE EXCEPTION 'empresa_id (%) não corresponde à empresa do colaborador % (empresa %)',
              NEW.empresa_id, NEW.colaborador_id, v_empresa_real;
      END IF;

      RETURN NEW;
  END;
  $BODY$ LANGUAGE plpgsql`,

  `DO $BODY$
  BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validar_empresa_vinculo') THEN
          CREATE TRIGGER trg_validar_empresa_vinculo
          BEFORE INSERT OR UPDATE ON colaborador_vinculos
          FOR EACH ROW EXECUTE FUNCTION dp_validar_empresa_colaborador();
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validar_empresa_prolabore') THEN
          CREATE TRIGGER trg_validar_empresa_prolabore
          BEFORE INSERT OR UPDATE ON pro_labore_pagamentos
          FOR EACH ROW EXECUTE FUNCTION dp_validar_empresa_colaborador();
      END IF;
  END $BODY$`,
];

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json(
      { error: "Só admin pode rodar o setup do DP." },
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
