import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

async function ensureTabela() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS obrigacoes_acessorias (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      descricao TEXT,
      periodo VARCHAR(10),
      data_vencimento DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
      data_entrega DATE,
      observacao TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest) {
  await ensureTabela();
  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresa_id");

  const where = empresaId ? sql`WHERE empresa_id = ${Number(empresaId)}` : sql``;
  const r = await db.execute(sql`
    SELECT * FROM obrigacoes_acessorias
    ${where}
    ORDER BY data_vencimento ASC
  `);
  return NextResponse.json({ ok: true, obrigacoes: r.rows });
}

export async function POST(req: NextRequest) {
  await ensureTabela();
  const body = await req.json();
  const { empresa_id, tipo, descricao, periodo, data_vencimento, observacao } = body;

  if (!empresa_id || !tipo || !data_vencimento) {
    return NextResponse.json(
      { ok: false, mensagem: "empresa_id, tipo e data_vencimento são obrigatórios." },
      { status: 400 }
    );
  }

  await db.execute(sql`
    INSERT INTO obrigacoes_acessorias (empresa_id, tipo, descricao, periodo, data_vencimento, observacao)
    VALUES (${empresa_id}, ${tipo}, ${descricao ?? null}, ${periodo ?? null}, ${data_vencimento}, ${observacao ?? null})
  `);

  return NextResponse.json({ ok: true, mensagem: "Obrigação cadastrada." });
}

export async function PATCH(req: NextRequest) {
  await ensureTabela();
  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { ok: false, mensagem: "id e status são obrigatórios." },
      { status: 400 }
    );
  }

  if (status === "ENTREGUE") {
    await db.execute(sql`
      UPDATE obrigacoes_acessorias
      SET status = 'ENTREGUE', data_entrega = CURRENT_DATE
      WHERE id = ${id}
    `);
  } else {
    await db.execute(sql`
      UPDATE obrigacoes_acessorias
      SET status = ${status}
      WHERE id = ${id}
    `);
  }

  return NextResponse.json({ ok: true, mensagem: "Status atualizado." });
}
