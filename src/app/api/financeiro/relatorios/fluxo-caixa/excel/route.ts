import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/financeiro/relatorios/fluxo-caixa/excel?meses=6
// Mesma logica da versao PDF, exportando como planilha .xlsx.
// Tambem exige empresa_ativa_id explicito -- nunca escolhe sozinho.
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const empresaIdRaw = cookieStore.get("empresa_ativa_id")?.value;
    if (!empresaIdRaw) {
      return NextResponse.json(
        { ok: false, error: "Nenhuma empresa selecionada. Selecione uma empresa antes de gerar o relatorio." },
        { status: 400 }
      );
    }
    const empresaId = Number(empresaIdRaw);

    const url = new URL(req.url);
    const meses = Math.min(24, Math.max(1, Number(url.searchParams.get("meses") ?? 6)));

    const empresaQ = await db.execute<{ nome: string; cnpj: string }>(sql`
      SELECT nome, cnpj FROM empresas WHERE id = ${empresaId} LIMIT 1
    `);
    const empresa = empresaQ.rows[0];
    if (!empresa) {
      return NextResponse.json({ ok: false, error: "Empresa nao encontrada." }, { status: 404 });
    }

    const receberQ = await db.execute<{ mes: string; total: string }>(sql`
      SELECT to_char(vencimento, 'YYYY-MM') AS mes, COALESCE(SUM(valor),0)::text AS total
      FROM contas_receber
      WHERE empresa_id = ${empresaId}
        AND vencimento >= (CURRENT_DATE - (${meses}::int || ' months')::interval)
      GROUP BY mes ORDER BY mes
    `);
    const pagarQ = await db.execute<{ mes: string; total: string }>(sql`
      SELECT to_char(vencimento, 'YYYY-MM') AS mes, COALESCE(SUM(valor),0)::text AS total
      FROM contas_pagar
      WHERE empresa_id = ${empresaId}
        AND vencimento >= (CURRENT_DATE - (${meses}::int || ' months')::interval)
      GROUP BY mes ORDER BY mes
    `);

    const mapaEntradas = new Map(receberQ.rows.map((r) => [r.mes, Number(r.total)]));
    const mapaSaidas = new Map(pagarQ.rows.map((r) => [r.mes, Number(r.total)]));
    const todosMeses = Array.from(new Set([...mapaEntradas.keys(), ...mapaSaidas.keys()])).sort();

    let saldoAcumulado = 0;
    const linhas = todosMeses.map((mes) => {
      const entradas = mapaEntradas.get(mes) ?? 0;
      const saidas = mapaSaidas.get(mes) ?? 0;
      saldoAcumulado += entradas - saidas;
      return { mes, entradas, saidas, saldo: saldoAcumulado };
    });

    // Detalhe: linhas individuais de contas a receber e a pagar, para uma
    // segunda aba com o detalhamento completo (nao so o resumo mensal).
    const detalheReceberQ = await db.execute<{
      participante: string; emissao: string; vencimento: string; valor: string; status: string;
    }>(sql`
      SELECT participante, emissao::text, vencimento::text, valor::text, status
      FROM contas_receber
      WHERE empresa_id = ${empresaId}
      ORDER BY vencimento
    `);
    const detalhePagarQ = await db.execute<{
      participante: string; emissao: string; vencimento: string; valor: string; status: string;
    }>(sql`
      SELECT participante, emissao::text, vencimento::text, valor::text, status
      FROM contas_pagar
      WHERE empresa_id = ${empresaId}
      ORDER BY vencimento
    `);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Contabil Pro";
    wb.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" },
    };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
    const moneyFmt = '"R$" #,##0.00';

    // Aba 1: Resumo mensal
    const wsResumo = wb.addWorksheet("Fluxo de Caixa");
    wsResumo.mergeCells("A1:D1");
    wsResumo.getCell("A1").value = `Fluxo de Caixa — ${empresa.nome} (CNPJ ${empresa.cnpj})`;
    wsResumo.getCell("A1").font = { bold: true, size: 14 };
    wsResumo.mergeCells("A2:D2");
    wsResumo.getCell("A2").value = `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
    wsResumo.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF888888" } };

    wsResumo.getRow(4).values = ["Mes", "Entradas", "Saidas", "Saldo Acumulado"];
    wsResumo.getRow(4).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });
    wsResumo.columns = [
      { key: "mes", width: 16 },
      { key: "entradas", width: 18 },
      { key: "saidas", width: 18 },
      { key: "saldo", width: 20 },
    ];

    const nomesMes: Record<string, string> = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Marco", "04": "Abril",
      "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
      "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
    };
    const formatarMes = (m: string) => {
      const [ano, mesNum] = m.split("-");
      return `${nomesMes[mesNum] ?? mesNum}/${ano}`;
    };

    let rowIdx = 5;
    for (const linha of linhas) {
      const row = wsResumo.getRow(rowIdx);
      row.values = [formatarMes(linha.mes), linha.entradas, linha.saidas, linha.saldo];
      row.getCell(2).numFmt = moneyFmt;
      row.getCell(3).numFmt = moneyFmt;
      row.getCell(4).numFmt = moneyFmt;
      if (linha.saldo < 0) row.getCell(4).font = { color: { argb: "FFC0392B" } };
      rowIdx++;
    }
    const totalEntradas = linhas.reduce((a, l) => a + l.entradas, 0);
    const totalSaidas = linhas.reduce((a, l) => a + l.saidas, 0);
    const totalRow = wsResumo.getRow(rowIdx + 1);
    totalRow.values = ["TOTAL", totalEntradas, totalSaidas, saldoAcumulado];
    totalRow.font = { bold: true };
    totalRow.getCell(2).numFmt = moneyFmt;
    totalRow.getCell(3).numFmt = moneyFmt;
    totalRow.getCell(4).numFmt = moneyFmt;

    // Aba 2: Detalhe Contas a Receber
    const wsReceber = wb.addWorksheet("Contas a Receber");
    wsReceber.getRow(1).values = ["Participante", "Emissao", "Vencimento", "Valor", "Status"];
    wsReceber.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });
    wsReceber.columns = [
      { key: "part", width: 40 },
      { key: "emi", width: 14 },
      { key: "venc", width: 14 },
      { key: "val", width: 16 },
      { key: "st", width: 14 },
    ];
    detalheReceberQ.rows.forEach((r, i) => {
      const row = wsReceber.getRow(i + 2);
      row.values = [r.participante, r.emissao, r.vencimento, Number(r.valor), r.status];
      row.getCell(4).numFmt = moneyFmt;
    });

    // Aba 3: Detalhe Contas a Pagar
    const wsPagar = wb.addWorksheet("Contas a Pagar");
    wsPagar.getRow(1).values = ["Participante", "Emissao", "Vencimento", "Valor", "Status"];
    wsPagar.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });
    wsPagar.columns = [
      { key: "part", width: 40 },
      { key: "emi", width: 14 },
      { key: "venc", width: 14 },
      { key: "val", width: 16 },
      { key: "st", width: 14 },
    ];
    detalhePagarQ.rows.forEach((r, i) => {
      const row = wsPagar.getRow(i + 2);
      row.values = [r.participante, r.emissao, r.vencimento, Number(r.valor), r.status];
      row.getCell(4).numFmt = moneyFmt;
    });

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer as unknown as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="fluxo-caixa-${empresa.cnpj}-${new Date().toISOString().substring(0, 10)}.xlsx"`,
      },
    });
  } catch (e) {
    console.error("fluxo-caixa/excel error:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}


