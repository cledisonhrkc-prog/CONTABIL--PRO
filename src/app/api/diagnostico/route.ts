import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { PLANO_CONTAS_PADRAO } from "@/lib/plano-contas";
import {
  planoContas,
  empresas,
  notasFiscais,
  lancamentos,
  bancos,
  itensNf,
  lancamentoItens,
  apuracaoImpostos,
  auditoria,
  contasReceber,
  contasPagar,
  exercicios,
} from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TABELAS_ESPERADAS = [
  "empresas",
  "plano_contas",
  "notas_fiscais",
  "itens_nf",
  "lancamentos",
  "lancamento_itens",
  "apuracao_impostos",
  "exercicios",
  "auditoria",
  "contas_receber",
  "contas_pagar",
  "bancos",
];

export async function GET() {
  const inicio = Date.now();
  const diag: {
    ok: boolean;
    passo: string;
    detalhes: Record<string, unknown>;
    proxima_acao?: string;
    tempo_ms: number;
  } = {
    ok: false,
    passo: "início",
    detalhes: {},
    tempo_ms: 0,
  };

  try {
    // 1) DATABASE_URL configurada?
    diag.passo = "1. Verificar DATABASE_URL";
    const url = process.env.DATABASE_URL || "";
    diag.detalhes.database_url_configurada = !!url;
    if (!url) {
      diag.proxima_acao =
        "Configure DATABASE_URL no painel do Vercel: Project Settings → Environment Variables";
      diag.tempo_ms = Date.now() - inicio;
      return NextResponse.json(diag, { status: 500 });
    }
    diag.detalhes.database_url_host = url.replace(/postgresql:\/\/[^@]+@/, "postgresql://***@").substring(0, 90) + "...";

    // 2) Conexão funciona?
    diag.passo = "2. Testar conexão com Postgres";
    await db.execute(sql`SELECT 1 as t`);
    diag.detalhes.conexao_ok = true;

    // 3) Tabelas existem?
    diag.passo = "3. Verificar tabelas";
    const tabRes = await db.execute<{ tablename: string }>(sql`
      SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
    `);
    const tabelasExistentes = tabRes.rows.map((r) => r.tablename);
    diag.detalhes.tabelas_existentes = tabelasExistentes;
    const faltando = TABELAS_ESPERADAS.filter((t) => !tabelasExistentes.includes(t));
    diag.detalhes.tabelas_faltando = faltando;
    if (faltando.length > 0) {
      diag.proxima_acao =
        "Rode o script drizzle/0000_initial_supabase.sql no SQL Editor do Supabase. OU chame POST /api/diagnostico?auto=1 pra tentar criar automaticamente.";
      diag.tempo_ms = Date.now() - inicio;
      return NextResponse.json(diag, { status: 500 });
    }

    // 4) Contagem de registros
    diag.passo = "4. Contar registros";
    const contagens: Record<string, number> = {};
    const conta = async (tabela: string) => {
      const r = await db.execute<{ c: string }>(sql`SELECT count(*)::text AS c FROM ${sql.identifier(tabela)}`);
      contagens[tabela] = Number(r.rows[0]?.c ?? 0);
    };
    for (const t of TABELAS_ESPERADAS) await conta(t);
    diag.detalhes.contagens = contagens;

    // 5) Plano de contas populado?
    if (contagens.plano_contas === 0) {
      diag.proxima_acao =
        "Plano de contas vazio. Chame POST /api/diagnostico?auto=1 para popular automaticamente.";
    } else if (contagens.empresas === 0) {
      diag.proxima_acao =
        "Banco pronto e vazio. Vá em /importar e envie os XMLs de NF-e reais do cliente.";
    } else {
      diag.proxima_acao = "Tudo OK. Sistema pronto para uso.";
    }

    diag.ok = true;
    diag.passo = "concluído";
    diag.tempo_ms = Date.now() - inicio;
    return NextResponse.json(diag);
  } catch (e) {
    diag.detalhes.erro = (e as Error).message;
    diag.tempo_ms = Date.now() - inicio;
    diag.proxima_acao =
      "Erro ao consultar o banco. Verifique: (a) URL do Supabase usa a porta 6543 (Transaction Pooler); (b) a senha está correta; (c) o projeto Supabase não está pausado.";
    return NextResponse.json(diag, { status: 500 });
  }
}

// POST /api/diagnostico?auto=1     -> cria tabelas + popula plano de contas
// POST /api/diagnostico?reset=1    -> LIMPA TODOS OS DADOS (mantém tabelas)
// POST /api/diagnostico?upgrade=1  -> aplica upgrades de schema com segurança
//                                     (remove dupes órfãs + cria índice UNIQUE)
export async function POST(req: Request) {
  const url = new URL(req.url);
  const auto = url.searchParams.get("auto") === "1";
  const reset = url.searchParams.get("reset") === "1";
  const upgrade = url.searchParams.get("upgrade") === "1";
  const t0 = Date.now();
  const passos: string[] = [];

  try {
    if (upgrade) {
      passos.push("1. Verificando duplicatas em notas_fiscais...");
      const dupCount = await db.execute<{ c: string }>(sql`
        SELECT COUNT(*)::text AS c FROM (
          SELECT empresa_id, chave, COUNT(*)
          FROM notas_fiscais
          WHERE chave IS NOT NULL AND chave <> ''
          GROUP BY empresa_id, chave
          HAVING COUNT(*) > 1
        ) t
      `);
      const nDup = Number(dupCount.rows[0]?.c ?? 0);
      passos.push(`   → ${nDup} chaves duplicadas encontradas`);

      if (nDup > 0) {
        passos.push("2. Removendo duplicatas (mantém a MENOR id de cada chave)...");
        // Apaga itens_nf, lançamentos e auditoria das notas duplicadas primeiro
        await db.execute(sql`
          WITH dupes AS (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY empresa_id, chave ORDER BY id ASC
              ) AS rn FROM notas_fiscais
              WHERE chave IS NOT NULL AND chave <> ''
            ) t WHERE rn > 1
          )
          DELETE FROM lancamento_itens
          WHERE id_lanc IN (SELECT id FROM lancamentos WHERE id_nf IN (SELECT id FROM dupes))
        `);
        await db.execute(sql`
          DELETE FROM lancamentos WHERE id_nf IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY empresa_id, chave ORDER BY id ASC
              ) AS rn FROM notas_fiscais
              WHERE chave IS NOT NULL AND chave <> ''
            ) t WHERE rn > 1
          )
        `);
        await db.execute(sql`
          DELETE FROM auditoria WHERE id_nf IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY empresa_id, chave ORDER BY id ASC
              ) AS rn FROM notas_fiscais
              WHERE chave IS NOT NULL AND chave <> ''
            ) t WHERE rn > 1
          )
        `);
        await db.execute(sql`
          DELETE FROM contas_receber WHERE id_nf IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY empresa_id, chave ORDER BY id ASC
              ) AS rn FROM notas_fiscais
              WHERE chave IS NOT NULL AND chave <> ''
            ) t WHERE rn > 1
          )
        `);
        await db.execute(sql`
          DELETE FROM contas_pagar WHERE id_nf IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY empresa_id, chave ORDER BY id ASC
              ) AS rn FROM notas_fiscais
              WHERE chave IS NOT NULL AND chave <> ''
            ) t WHERE rn > 1
          )
        `);
        await db.execute(sql`
          DELETE FROM itens_nf WHERE id_nf IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY empresa_id, chave ORDER BY id ASC
              ) AS rn FROM notas_fiscais
              WHERE chave IS NOT NULL AND chave <> ''
            ) t WHERE rn > 1
          )
        `);
        const del = await db.execute<{ c: string }>(sql`
          WITH x AS (
            DELETE FROM notas_fiscais WHERE id IN (
              SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                  PARTITION BY empresa_id, chave ORDER BY id ASC
                ) AS rn FROM notas_fiscais
                WHERE chave IS NOT NULL AND chave <> ''
              ) t WHERE rn > 1
            )
            RETURNING id
          )
          SELECT COUNT(*)::text AS c FROM x
        `);
        passos.push(`   ✓ ${del.rows[0]?.c ?? 0} notas duplicadas apagadas em cascata`);
      } else {
        passos.push("   ✓ Nenhuma duplicata para remover");
      }

      passos.push("3. Criando índice UNIQUE (empresa_id, chave) em notas_fiscais...");
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS unq_nf_empresa_chave
        ON notas_fiscais(empresa_id, chave)
      `);
      passos.push("   ✓ Índice UNIQUE criado");

      passos.push("4. Criando índices auxiliares...");
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_nf_empresa_data ON notas_fiscais(empresa_id, data_emissao)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lanc_empresa_comp ON lancamentos(empresa_id, competencia)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lanc_itens_lanc ON lancamento_itens(id_lanc)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lanc_itens_conta ON lancamento_itens(codigo_conta)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_empresa ON auditoria(empresa_id)`);
      passos.push("   ✓ Índices auxiliares criados");
    }
    if (reset) {
      passos.push("1. LIMPANDO todos os dados (mantém tabelas)...");
      await db.execute(sql`
        TRUNCATE lancamento_itens, lancamentos, auditoria, contas_receber,
                 contas_pagar, apuracao_impostos, exercicios, itens_nf,
                 notas_fiscais, bancos, empresas
        RESTART IDENTITY CASCADE
      `);
      passos.push("   ✓ Dados apagados");

      passos.push("2. Repopulando plano de contas padrão...");
      await db.execute(sql`DELETE FROM plano_contas`);
      await db.insert(planoContas).values(PLANO_CONTAS_PADRAO);
      passos.push("   ✓ Plano de contas repopulado");
    }
    if (auto) {
      passos.push("1. Verificando/criando tabelas via CREATE IF NOT EXISTS...");
      await db.execute(sql.raw(SQL_CREATE_TABLES));
      passos.push("   ✓ Tabelas criadas/verificadas");

      passos.push("2. Populando plano de contas padrão...");
      await db
        .insert(planoContas)
        .values(PLANO_CONTAS_PADRAO)
        .onConflictDoNothing({ target: planoContas.codigo });
      const r = await db.execute<{ c: string }>(sql`SELECT count(*)::text AS c FROM plano_contas`);
      passos.push(`   ✓ Plano de contas: ${r.rows[0]?.c ?? 0} contas`);
    }

    return NextResponse.json({
      ok: true,
      passos,
      tempo_ms: Date.now() - t0,
      proxima_acao: reset
        ? "Banco limpo. Vá em /importar para subir os XMLs do cliente."
        : "Banco pronto. Vá em /importar para subir os XMLs do cliente.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        passos,
        erro: (e as Error).message,
        tempo_ms: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}

// Uso das tabelas importadas para o TypeScript não reclamar de imports não usados
export const _tabelas_referencia = {
  empresas, notasFiscais, lancamentos, bancos, itensNf, lancamentoItens,
  apuracaoImpostos, auditoria, contasReceber, contasPagar, exercicios,
};

// SQL bruto para criar todas as tabelas — mesmo conteúdo de drizzle/0000_initial_supabase.sql
const SQL_CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS "apuracao_impostos" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "periodo" varchar(10) NOT NULL,
  "imposto" varchar(20) NOT NULL,
  "debito" numeric(18,2) DEFAULT '0',
  "credito" numeric(18,2) DEFAULT '0',
  "apurado" numeric(18,2) DEFAULT '0',
  "a_pagar" numeric(18,2) DEFAULT '0'
);
CREATE TABLE IF NOT EXISTS "auditoria" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "id_nf" integer,
  "numero_nf" varchar(20),
  "regra" varchar(20),
  "tipo" varchar(20),
  "ncm" varchar(15),
  "cst_pis" varchar(4),
  "cst_cof" varchar(4),
  "descricao" text,
  "valor_nota" numeric(18,2) DEFAULT '0',
  "valor_credito" numeric(18,2) DEFAULT '0',
  "regime" varchar(20),
  "acao" text
);
CREATE TABLE IF NOT EXISTS "bancos" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "nome" text NOT NULL,
  "agencia" varchar(20),
  "conta" varchar(30),
  "saldo" numeric(18,2) DEFAULT '0'
);
CREATE TABLE IF NOT EXISTS "contas_pagar" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "id_nf" integer,
  "participante" text,
  "emissao" date,
  "vencimento" date,
  "valor" numeric(18,2) DEFAULT '0',
  "status" varchar(20) DEFAULT 'ABERTO'
);
CREATE TABLE IF NOT EXISTS "contas_receber" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "id_nf" integer,
  "participante" text,
  "emissao" date,
  "vencimento" date,
  "valor" numeric(18,2) DEFAULT '0',
  "status" varchar(20) DEFAULT 'ABERTO'
);
CREATE TABLE IF NOT EXISTS "empresas" (
  "id" serial PRIMARY KEY NOT NULL,
  "cnpj" varchar(20) NOT NULL UNIQUE,
  "nome" text NOT NULL,
  "regime" varchar(20) DEFAULT 'SIMPLES' NOT NULL,
  "anexo_simples" varchar(4) DEFAULT 'I',
  "segmento" varchar(40) DEFAULT 'COMERCIO',
  "rbt12" numeric(18,2) DEFAULT '0',
  "cmv_percent" numeric(6,4) DEFAULT '0.6000',
  "created_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "exercicios" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "ano" integer NOT NULL,
  "status" varchar(20) DEFAULT 'ABERTO',
  "resultado" numeric(18,2) DEFAULT '0'
);
CREATE TABLE IF NOT EXISTS "itens_nf" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_nf" integer NOT NULL,
  "cprod" varchar(40),
  "xprod" text,
  "ncm" varchar(15),
  "cfop" varchar(8),
  "quantidade" numeric(18,4) DEFAULT '0',
  "valor_unitario" numeric(18,6) DEFAULT '0',
  "valor_total" numeric(18,2) DEFAULT '0',
  "cst_pis" varchar(4),
  "cst_cof" varchar(4)
);
CREATE TABLE IF NOT EXISTS "lancamento_itens" (
  "id" serial PRIMARY KEY NOT NULL,
  "id_lanc" integer NOT NULL,
  "codigo_conta" varchar(20) NOT NULL,
  "debito" numeric(18,2) DEFAULT '0',
  "credito" numeric(18,2) DEFAULT '0'
);
CREATE TABLE IF NOT EXISTS "lancamentos" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "numero" varchar(20) NOT NULL UNIQUE,
  "data" date NOT NULL,
  "competencia" date NOT NULL,
  "exercicio" integer NOT NULL,
  "historico" text,
  "id_nf" integer,
  "origem" varchar(20) DEFAULT 'FISCAL',
  "tipo_lanc" varchar(20) DEFAULT 'NORMAL',
  "valor_total" numeric(18,2) DEFAULT '0'
);
CREATE TABLE IF NOT EXISTS "notas_fiscais" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer NOT NULL,
  "chave" varchar(60),
  "numero" varchar(20),
  "serie" varchar(10),
  "modelo" varchar(5),
  "tipo_operacao" varchar(10),
  "finalidade" varchar(15),
  "data_emissao" date,
  "participante" text,
  "cnpj_part" varchar(20),
  "valor_produtos" numeric(18,2) DEFAULT '0',
  "valor_frete" numeric(18,2) DEFAULT '0',
  "valor_seguro" numeric(18,2) DEFAULT '0',
  "valor_desconto" numeric(18,2) DEFAULT '0',
  "valor_outras" numeric(18,2) DEFAULT '0',
  "valor_total" numeric(18,2) DEFAULT '0',
  "valor_icms" numeric(18,2) DEFAULT '0',
  "valor_icms_st" numeric(18,2) DEFAULT '0',
  "valor_ipi" numeric(18,2) DEFAULT '0',
  "valor_pis" numeric(18,2) DEFAULT '0',
  "valor_cofins" numeric(18,2) DEFAULT '0',
  "valor_iss" numeric(18,2) DEFAULT '0',
  "created_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "plano_contas" (
  "codigo" varchar(20) PRIMARY KEY NOT NULL,
  "descricao" text NOT NULL,
  "tipo" varchar(32) NOT NULL,
  "natureza" varchar(12) NOT NULL,
  "nivel" integer NOT NULL,
  "conta_pai" varchar(20)
);
CREATE INDEX IF NOT EXISTS idx_nf_empresa_data ON notas_fiscais(empresa_id, data_emissao);
CREATE UNIQUE INDEX IF NOT EXISTS unq_nf_empresa_chave ON notas_fiscais(empresa_id, chave);
CREATE INDEX IF NOT EXISTS idx_lanc_empresa_comp ON lancamentos(empresa_id, competencia);
CREATE INDEX IF NOT EXISTS idx_lanc_itens_lanc ON lancamento_itens(id_lanc);
CREATE INDEX IF NOT EXISTS idx_lanc_itens_conta ON lancamento_itens(codigo_conta);
CREATE INDEX IF NOT EXISTS idx_audit_empresa ON auditoria(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cr_empresa ON contas_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cp_empresa ON contas_pagar(empresa_id);
`;
