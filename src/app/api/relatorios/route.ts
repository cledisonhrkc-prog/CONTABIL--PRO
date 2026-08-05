import { NextResponse } from "next/server";
import {
  balancete,
  balanco,
  dre,
  apuracao,
  notas,
  razao,
  aging,
  auditoriaR08,
  dashboardResumo,
  fluxoCaixaMensal,
  topDespesas,
  atividadesRecentes,
} from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") ?? "dashboard";
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Nenhuma empresa cadastrada" }, { status: 404 });
  const empId = emp.id;
  const ano = Number(url.searchParams.get("ano") ?? new Date().getFullYear());

  switch (tipo) {
    case "balancete":
      return NextResponse.json({ ok: true, dados: await balancete(empId) });
    case "balanco":
      return NextResponse.json({ ok: true, dados: await balanco(empId) });
    case "dre":
      return NextResponse.json({ ok: true, dados: await dre(empId, ano), ano });
    case "apuracao":
      return NextResponse.json({ ok: true, dados: await apuracao(empId) });
    case "notas":
      return NextResponse.json({ ok: true, dados: await notas(empId, 1000) });
    case "razao":
      return NextResponse.json({ ok: true, dados: await razao(empId, 2000) });
    case "aging":
      return NextResponse.json({ ok: true, dados: await aging(empId) });
    case "auditoria":
      return NextResponse.json({ ok: true, dados: await auditoriaR08(empId) });
    case "fluxo":
      return NextResponse.json({ ok: true, dados: await fluxoCaixaMensal(empId) });
    case "top_despesas":
      return NextResponse.json({ ok: true, dados: await topDespesas(empId) });
    case "atividades":
      return NextResponse.json({ ok: true, dados: await atividadesRecentes(empId) });
    default:
      return NextResponse.json({
        ok: true,
        empresa: emp,
        resumo: await dashboardResumo(empId),
        fluxo: await fluxoCaixaMensal(empId),
        top_despesas: await topDespesas(empId),
        atividades: await atividadesRecentes(empId),
      });
  }
}
