import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/empresa-lookup?cnpj=07566851000145
// Consulta somente-leitura: retorna os dados JA CADASTRADOS de uma empresa,
// se existir. Usado pela tela de importação para preencher automaticamente
// o regime/nome CORRETOS quando a empresa já é cliente conhecido -- em vez
// de tentar adivinhar pelo XML (que nem sempre traz CRT, ex: notas de compra
// onde a empresa aparece só como destinatária).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cnpjRaw = url.searchParams.get("cnpj") ?? "";
  const cnpj = cnpjRaw.replace(/\D/g, "");

  if (!cnpj) {
    return NextResponse.json({ ok: false, error: "cnpj obrigatorio" }, { status: 400 });
  }

  try {
    const r = await db.execute<{
      cnpj: string;
      nome: string;
      regime: string;
      anexo_simples: string | null;
    }>(sql`
      SELECT cnpj, nome, regime, anexo_simples
      FROM empresas
      WHERE cnpj = ${cnpj}
      LIMIT 1
    `);
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({ ok: true, existe: false });
    }
    return NextResponse.json({
      ok: true,
      existe: true,
      cnpj: row.cnpj,
      nome: row.nome,
      regime: row.regime,
      anexo_simples: row.anexo_simples ?? "I",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
