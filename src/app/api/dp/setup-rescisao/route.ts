import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Setup do schema de rescisão. Idempotente, só admin.
 *   GET https://contabil-pro-wheat.vercel.app/api/dp/setup-rescisao
 */

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dp_parametro_sistema (
    chave VARCHAR(100) PRIMARY KEY,
    valor NUMERIC(15,4) NOT NULL,
    descricao TEXT
  )`,
  `INSERT INTO dp_parametro_sistema (chave, valor, descricao) VALUES
    ('FGTS_ALIQUOTA', 0.08, 'Alíquota FGTS mensal'),
    ('MULTA_FGTS', 0.40, 'Multa rescisória sobre FGTS (sem justa causa)')
  ON CONFLICT (chave) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS dp_rescisoes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    vinculo_id INTEGER NOT NULL REFERENCES colaborador_vinculos(id) ON DELETE CASCADE,
    data_demissao DATE NOT NULL,
    motivo VARCHAR(30) NOT NULL CHECK (motivo IN ('SEM_JUSTA_CAUSA', 'COM_JUSTA_CAUSA', 'PEDIDO_DEMISSAO')),
    saldo_salario NUMERIC(15,2) DEFAULT 0,
    aviso_previo_indenizado NUMERIC(15,2) DEFAULT 0,
    ferias_proporcionais NUMERIC(15,2) DEFAULT 0,
    terco_ferias_proporcionais NUMERIC(15,2) DEFAULT 0,
    decimo_terceiro_proporcional NUMERIC(15,2) DEFAULT 0,
    multa_fgts NUMERIC(15,2) DEFAULT 0,
    valor_inss NUMERIC(15,2) DEFAULT 0,
    valor_irrf NUMERIC(15,2) DEFAULT 0,
    total_proventos NUMERIC(15,2) DEFAULT 0,
    total_descontos NUMERIC(15,2) DEFAULT 0,
    total_liquido NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'CALCULADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dp_rescisoes_empresa ON dp_rescisoes(empresa_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dp_rescisoes_vinculo ON dp_rescisoes(vinculo_id)`,
];

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este setup." }, { status: 403 });
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
