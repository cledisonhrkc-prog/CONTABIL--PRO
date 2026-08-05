import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  balancete,
  balanco,
  dre,
  apuracao,
  notas,
  razao,
  aging,
  auditoriaR08,
} from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";
import { db } from "@/db";
import { exercicios } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { bottom: { style: "thin", color: { argb: "FFB7791F" } } };
  });
}

function moneyFmt(col: ExcelJS.Column) {
  col.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  col.width = 18;
}

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGC Contábil Pro";
  wb.created = new Date();

  // Capa
  const capa = wb.addWorksheet("CAPA");
  capa.addRow(["SIGC - Sistema Contábil Pro"]).font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
  capa.addRow([`Empresa: ${emp.nome}`]);
  capa.addRow([`CNPJ: ${emp.cnpj}`]);
  capa.addRow([`Regime: ${emp.regime}`]);
  capa.addRow([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
  capa.getColumn(1).width = 60;

  // Balanço
  const bal = await balanco(emp.id);
  const wsBal = wb.addWorksheet("BALANCO");
  styleHeader(wsBal.addRow(["Grupo", "Saldo (R$)"]));
  wsBal.addRow(["ATIVO", bal.ativo]);
  wsBal.addRow(["PASSIVO", bal.passivo]);
  wsBal.addRow(["PATRIMÔNIO LÍQUIDO", bal.pl]);
  wsBal.addRow(["Verificação (Ativo = P + PL)", bal.ativo - (bal.passivo + bal.pl)]);
  wsBal.getColumn(1).width = 35;
  moneyFmt(wsBal.getColumn(2));

  // DRE por exercício
  const exs = await db.select().from(exercicios).where(eq(exercicios.empresa_id, emp.id));
  for (const ex of exs) {
    const linhas = await dre(emp.id, ex.ano);
    const ws = wb.addWorksheet(`DRE_${ex.ano}`);
    styleHeader(ws.addRow(["DRE", `${ex.ano} (R$)`]));
    for (const l of linhas) {
      const r = ws.addRow([l.descricao, l.valor]);
      if (l.destaque) r.font = { bold: true };
    }
    ws.getColumn(1).width = 40;
    moneyFmt(ws.getColumn(2));
  }

  // Balancete
  const bcRows = await balancete(emp.id);
  const wsBc = wb.addWorksheet("BALANCETE");
  styleHeader(wsBc.addRow(["Código", "Descrição", "Tipo", "Natureza", "Débito", "Crédito", "Saldo"]));
  for (const r of bcRows) {
    wsBc.addRow([r.codigo, r.descricao, r.tipo, r.natureza, r.debito, r.credito, r.saldo]);
  }
  wsBc.getColumn(1).width = 12;
  wsBc.getColumn(2).width = 40;
  wsBc.getColumn(3).width = 18;
  wsBc.getColumn(4).width = 14;
  moneyFmt(wsBc.getColumn(5));
  moneyFmt(wsBc.getColumn(6));
  moneyFmt(wsBc.getColumn(7));

  // Apuração
  const apRows = await apuracao(emp.id);
  const wsAp = wb.addWorksheet("APURACAO_IMPOSTOS");
  styleHeader(wsAp.addRow(["Período", "Imposto", "Débito", "Crédito", "Apurado", "A Pagar"]));
  for (const r of apRows) {
    wsAp.addRow([r.periodo, r.imposto, r.debito, r.credito, r.apurado, r.a_pagar]);
  }
  wsAp.getColumn(1).width = 12;
  wsAp.getColumn(2).width = 18;
  moneyFmt(wsAp.getColumn(3));
  moneyFmt(wsAp.getColumn(4));
  moneyFmt(wsAp.getColumn(5));
  moneyFmt(wsAp.getColumn(6));

  // Notas
  const nRows = await notas(emp.id, 5000);
  const wsN = wb.addWorksheet("NOTAS");
  styleHeader(wsN.addRow(["Nº", "Série", "Operação", "Finalidade", "Emissão", "Participante", "Valor Total", "ICMS", "PIS", "COFINS"]));
  for (const r of nRows) {
    wsN.addRow([r.numero, r.serie, r.tipo_operacao, r.finalidade, r.data_emissao, r.participante, r.valor_total, r.valor_icms, r.valor_pis, r.valor_cofins]);
  }
  wsN.getColumn(6).width = 40;
  moneyFmt(wsN.getColumn(7));
  moneyFmt(wsN.getColumn(8));
  moneyFmt(wsN.getColumn(9));
  moneyFmt(wsN.getColumn(10));

  // Razão (limitado a 5000)
  const raRows = await razao(emp.id, 5000);
  const wsR = wb.addWorksheet("RAZAO");
  styleHeader(wsR.addRow(["Competência", "Lançamento", "Origem", "Histórico", "Conta", "Descrição", "Débito", "Crédito"]));
  for (const r of raRows) {
    wsR.addRow([r.competencia, r.numero, r.origem, r.historico, r.codigo_conta, r.descricao, r.debito, r.credito]);
  }
  wsR.getColumn(4).width = 40;
  wsR.getColumn(6).width = 30;
  moneyFmt(wsR.getColumn(7));
  moneyFmt(wsR.getColumn(8));

  // Aging
  const ag = await aging(emp.id);
  const wsA = wb.addWorksheet("AGING");
  styleHeader(wsA.addRow(["Tipo", "Status", "Qtd", "Saldo"]));
  for (const r of ag) wsA.addRow([r.tipo, r.status, r.qtd, r.saldo]);
  moneyFmt(wsA.getColumn(4));

  // Auditoria R08
  const au = await auditoriaR08(emp.id);
  const wsAu = wb.addWorksheet("AUDITORIA_R08");
  styleHeader(wsAu.addRow(["Nº NF", "Regra", "Tipo", "NCM", "CST PIS", "CST COFINS", "Regime", "Valor Nota", "Crédito", "Descrição", "Ação"]));
  for (const r of au) {
    wsAu.addRow([r.numero_nf, r.regra, r.tipo, r.ncm, r.cst_pis, r.cst_cof, r.regime, r.valor_nota, r.valor_credito, r.descricao, r.acao]);
  }
  wsAu.getColumn(10).width = 60;
  wsAu.getColumn(11).width = 60;
  moneyFmt(wsAu.getColumn(8));
  moneyFmt(wsAu.getColumn(9));

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sigc_relatorio_${Date.now()}.xlsx"`,
    },
  });
}
