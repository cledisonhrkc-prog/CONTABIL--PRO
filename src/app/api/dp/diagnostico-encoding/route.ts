import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Só leitura — mostra a extensão real do problema de encoding na tabela
 * auditoria antes de qualquer UPDATE. Não corrige nada, só diagnostica.
 *
 * GET /api/dp/diagnostico-encoding
 */
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este diagnóstico." }, { status: 403 });
  }

  // Busca por fragmentos puramente ASCII que aparecem tanto na versão
  // certa quanto na quebrada (ex: "Monof" está em "Monofásico" e em
  // "MonofÃ¡sico" igualmente) — evita depender do caractere "Ã" bater
  // byte a byte na comparação, que pode falhar por conta própria.
  const amostraDireta = await db.execute(sql`
    SELECT id, descricao, acao FROM auditoria
    WHERE descricao ILIKE '%Monof%' OR descricao ILIKE '%cr_dito%' OR acao ILIKE '%Monof%'
    LIMIT 10
  `);

  const total = await db.execute(sql`
    SELECT COUNT(*)::int AS qtd FROM auditoria WHERE descricao LIKE '%Ã%'
  `);

  const distintas = await db.execute(sql`
    SELECT DISTINCT descricao FROM auditoria WHERE descricao LIKE '%Ã%' LIMIT 50
  `);

  const totalAcao = await db.execute(sql`
    SELECT COUNT(*)::int AS qtd FROM auditoria WHERE acao LIKE '%Ã%'
  `);

  // Verifica também os bytes reais do primeiro caractere não-ASCII
  // encontrado numa linha, pra saber exatamente o que está gravado
  const bytesReais = await db.execute(sql`
    SELECT id, descricao, encode(descricao::bytea, 'hex') AS hex_completo
    FROM auditoria
    WHERE descricao ILIKE '%Monof%'
    LIMIT 1
  `);

  return NextResponse.json({
    amostra_direta_busca_ascii: amostraDireta.rows,
    linhas_com_descricao_quebrada_busca_especial: (total.rows[0] as any).qtd,
    linhas_com_acao_quebrada_busca_especial: (totalAcao.rows[0] as any).qtd,
    textos_distintos_quebrados: distintas.rows.map((r: any) => r.descricao),
    diagnostico_bytes: bytesReais.rows,
  });
}
