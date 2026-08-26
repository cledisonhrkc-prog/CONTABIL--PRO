import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/empresa";
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

/**
 * Teste 100% seguro do módulo Contábil/Fiscal — SÓ LEITURA. Nenhum INSERT,
 * nenhum risco de gravar dado de teste em produção. Roda cada relatório
 * real (o mesmo código que a tela usa) contra uma empresa que já existe,
 * um por um, sem deixar 1 erro travar o teste dos outros.
 *
 * GET /api/dp/teste-contabil-leitura?empresaId=24
 */
export async function GET(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este teste." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const empresaId = Number(searchParams.get("empresaId"));
  if (!empresaId) {
    return NextResponse.json({ error: "Informe ?empresaId=N na URL." }, { status: 400 });
  }

  const testes: Array<[string, () => Promise<any>]> = [
    ["balancete", () => balancete(empresaId)],
    ["balanco", () => balanco(empresaId)],
    ["dre_2026", () => dre(empresaId, 2026)],
    ["apuracao", () => apuracao(empresaId)],
    ["notas", () => notas(empresaId, 20)],
    ["razao", () => razao(empresaId, 20)],
    ["aging", () => aging(empresaId)],
    ["auditoriaR08", () => auditoriaR08(empresaId)],
    ["dashboardResumo", () => dashboardResumo(empresaId)],
    ["fluxoCaixaMensal", () => fluxoCaixaMensal(empresaId)],
    ["topDespesas", () => topDespesas(empresaId, 5)],
    ["atividadesRecentes", () => atividadesRecentes(empresaId, 5)],
  ];

  const resultado: Record<string, any> = {};
  for (const [nome, fn] of testes) {
    try {
      const inicio = Date.now();
      const r = await fn();
      const duracaoMs = Date.now() - inicio;
      resultado[nome] = {
        ok: true,
        duracaoMs,
        qtdRegistros: Array.isArray(r) ? r.length : 1,
        amostra: Array.isArray(r) ? r.slice(0, 3) : r,
      };
    } catch (e: any) {
      resultado[nome] = { ok: false, erro: e.message };
    }
  }

  const totalOk = Object.values(resultado).filter((r: any) => r.ok).length;
  return NextResponse.json({
    empresaId,
    totalTestado: testes.length,
    totalOk,
    totalFalhou: testes.length - totalOk,
    resultado,
  });
}
