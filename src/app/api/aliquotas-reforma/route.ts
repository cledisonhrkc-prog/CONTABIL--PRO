import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { verificarTokenSessao, ehAdmin } from "@/lib/auth";
import { ensureAliquotasReformaTable } from "@/lib/reforma";

const TRIBUTOS_VALIDOS = ["CBS_2026", "IBS_2026", "CBS_2027", "IBS_2029_INICIAL", "IBS_2033"];

async function exigirAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) return null;
  const admin = await ehAdmin(sessao.email);
  if (!admin) return null;
  return sessao;
}

export async function GET() {
  const sessao = await exigirAdmin();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem acessar." },
      { status: 403 }
    );
  }
  await ensureAliquotasReformaTable();

  const r = await db.execute<{
    id: number;
    tributo: string;
    aliquota: string;
    vigencia_inicio: string;
    vigencia_fim: string | null;
  }>(sql`
    SELECT id, tributo, aliquota, vigencia_inicio, vigencia_fim
    FROM aliquotas_reforma
    ORDER BY tributo, vigencia_inicio DESC
  `);

  return NextResponse.json({ ok: true, aliquotas: r.rows, tributos_validos: TRIBUTOS_VALIDOS });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirAdmin();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem cadastrar alíquotas." },
      { status: 403 }
    );
  }
  await ensureAliquotasReformaTable();

  const { tributo, aliquota, vigencia_inicio, vigencia_fim } = await req.json();

  if (!tributo || !TRIBUTOS_VALIDOS.includes(tributo)) {
    return NextResponse.json(
      { ok: false, mensagem: `tributo inválido. Use um destes: ${TRIBUTOS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (aliquota === undefined || aliquota === null || isNaN(Number(aliquota))) {
    return NextResponse.json(
      { ok: false, mensagem: "aliquota é obrigatória e deve ser um número (ex: 0.088 para 8,8%)." },
      { status: 400 }
    );
  }
  if (!vigencia_inicio) {
    return NextResponse.json(
      { ok: false, mensagem: "vigencia_inicio é obrigatória (formato AAAA-MM-DD)." },
      { status: 400 }
    );
  }

  await db.execute(sql`
    INSERT INTO aliquotas_reforma (tributo, aliquota, vigencia_inicio, vigencia_fim)
    VALUES (${tributo}, ${Number(aliquota)}, ${vigencia_inicio}, ${vigencia_fim ?? null})
  `);

  return NextResponse.json({
    ok: true,
    mensagem: `Alíquota de ${tributo} cadastrada com vigência a partir de ${vigencia_inicio}. Vale a partir da próxima contabilização (cache de 5 minutos).`,
  });
}
