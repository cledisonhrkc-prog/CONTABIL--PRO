import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getEmpresaAtiva } from "@/lib/empresa";
import {
  balanco,
  dre,
  apuracao,
  auditoriaR08,
  dashboardResumo,
  balancete,
  fluxoCaixaMensal,
  topDespesas,
} from "@/lib/relatorios";
import { comparativoAntesDepois, apuracaoReformaPorAno } from "@/lib/reforma-relatorios";
import { db } from "@/db";
import { exercicios } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Paleta de cores nível sênior
const COLORS = {
  primary: "#1F2937",   // Slate 800
  gold: "#B7791F",      // dourado sóbrio
  navy: "#0F172A",
  green: "#047857",
  red: "#B91C1C",
  gray: "#6B7280",
  lightGray: "#F3F4F6",
  border: "#E5E7EB",
  white: "#FFFFFF",
  orange: "#EA580C",
  slateSubtle: "#F8FAFC",
};

const fmtMoeda = (v: number) =>
  "R$ " +
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawKpi(doc: any, x: number, y: number, w: number, h: number, label: string, value: string, color = COLORS.primary) {
  doc.roundedRect(x, y, w, h, 4).fillAndStroke(COLORS.white, COLORS.border);
  doc.fillColor(COLORS.gray).font("Helvetica-Bold").fontSize(7).text(label, x + 10, y + 8, { width: w - 20 });
  doc.fillColor(color).font("Helvetica-Bold").fontSize(14).text(value, x + 10, y + 22, { width: w - 20 });
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > 720) doc.addPage();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(13).text(title, { align: "left" });
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor(COLORS.gold).lineWidth(1.5).stroke();
  doc.moveDown(0.6);
  doc.fillColor(COLORS.primary).font("Helvetica").fontSize(10);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  widths: number[],
  aligns: Array<"left" | "right" | "center"> = []
) {
  const startX = doc.page.margins.left;
  const totalW = widths.reduce((a, b) => a + b, 0);
  let y = doc.y;
  const rowH = 18;
  const headerH = 22;

  // Verifica quebra de página
  const check = (needed: number) => {
    if (y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  };

  check(headerH);
  // Header
  doc.rect(startX, y, totalW, headerH).fill(COLORS.primary);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(9);
    const align = aligns[i] ?? (i === 0 ? "left" : "right");
    doc.text(h, x + 6, y + 7, { width: widths[i] - 12, align });
    x += widths[i];
  });
  y += headerH;

  // Rows
  rows.forEach((row, ri) => {
    check(rowH);
    if (ri % 2 === 0) {
      doc.rect(startX, y, totalW, rowH).fill(COLORS.slateSubtle);
    }
    x = startX;
    row.forEach((v, i) => {
      doc.fillColor(COLORS.primary).font("Helvetica").fontSize(9);
      const align = aligns[i] ?? (i === 0 ? "left" : "right");
      doc.text(v, x + 6, y + 5, { width: widths[i] - 12, align, ellipsis: true, height: rowH - 2 });
      x += widths[i];
    });
    y += rowH;
  });
  // Border bottom
  doc.moveTo(startX, y).lineTo(startX + totalW, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.y = y + 8;
  doc.x = startX;
}

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  const resumo = await dashboardResumo(emp.id);
  const bal = await balanco(emp.id);
  const apRows = await apuracao(emp.id);
  const audit = await auditoriaR08(emp.id);
  const bc = await balancete(emp.id);
  const fluxo = await fluxoCaixaMensal(emp.id);
  const top = await topDespesas(emp.id, 8);
  const reforma = await comparativoAntesDepois(emp.id);
  const anosReforma = await apuracaoReformaPorAno(emp.id);
  const exs = await db.select().from(exercicios).where(eq(exercicios.empresa_id, emp.id));

  const totalPagar = apRows.reduce((a, r) => a + r.a_pagar, 0);
  const totalCredMono = audit.reduce((a, r) => a + r.valor_credito, 0);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 45, bottom: 50, left: 40, right: 40 },
    info: {
      Title: `Parecer Contábil-Fiscal — ${emp.nome}`,
      Author: "SIGC Contábil Pro",
      Subject: "Escrituração, Apuração de Impostos e Auditoria Fiscal",
    },
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // =========================================================
  // CAPA
  // =========================================================
  // Barra superior dourada
  doc.rect(0, 0, doc.page.width, 8).fill(COLORS.gold);
  // Barra lateral
  doc.rect(0, 8, 6, doc.page.height - 8).fill(COLORS.primary);

  doc.fillColor(COLORS.gold).font("Helvetica-Bold").fontSize(10).text("SIGC CONTÁBIL PRO", 40, 60);
  doc.fillColor(COLORS.gray).font("Helvetica").fontSize(8).text("Sistema de Escrituração Contábil-Fiscal Automatizada", 40, 74);

  doc.moveDown(6);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(11).text("PARECER TÉCNICO", { align: "left" });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(28).text("Escrituração Contábil,", { align: "left" });
  doc.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(28).text("Apuração de Impostos e", { align: "left" });
  doc.fillColor(COLORS.gold).font("Helvetica-Bold").fontSize(28).text("Auditoria de Conformidade", { align: "left" });

  doc.moveDown(1.5);
  doc.fillColor(COLORS.gray).font("Helvetica").fontSize(10);
  doc.text(`Cliente: ${emp.nome}`, { align: "left" });
  doc.text(`CNPJ: ${emp.cnpj}`, { align: "left" });
  doc.text(`Regime Tributário: ${emp.regime.replace("_", " ")}`, { align: "left" });
  doc.text(`Segmento: ${emp.segmento ?? "—"}`, { align: "left" });

  doc.moveDown(2);
  // KPIs na capa
  const kW = (contentW - 30) / 4;
  const kY = doc.y;
  drawKpi(doc, 40 + 0, kY, kW, 55, "NOTAS PROCESSADAS", String(resumo.qtd_notas), COLORS.navy);
  drawKpi(doc, 40 + kW + 10, kY, kW, 55, "VOLUME FATURADO", fmtMoeda(resumo.receitas), COLORS.green);
  drawKpi(doc, 40 + (kW + 10) * 2, kY, kW, 55, "IMPOSTOS APURADOS", fmtMoeda(totalPagar), COLORS.gold);
  drawKpi(doc, 40 + (kW + 10) * 3, kY, kW, 55, "CRÉDITO R08 REC.", fmtMoeda(totalCredMono), COLORS.red);
  doc.y = kY + 55 + 10;

  doc.moveDown(2);
  doc.fillColor(COLORS.gray).font("Helvetica-Oblique").fontSize(8)
    .text(`Documento emitido em ${new Date().toLocaleString("pt-BR")}`, { align: "left" });
  doc.text("Base legal: LC 123/2006 (Simples), Lei 10.147/2000 e Lei 10.485/2002 (Monofásico),", { align: "left" });
  doc.text("EC 132/2023 e LC 214/2025 (Reforma Tributária do Consumo).", { align: "left" });

  // Rodapé da capa
  doc.fillColor(COLORS.gold).font("Helvetica-Bold").fontSize(8)
    .text("FISCAL TECH", 40, doc.page.height - 60);
  doc.fillColor(COLORS.gray).font("Helvetica").fontSize(7)
    .text("Escrituração automatizada · Auditoria fiscal · Reforma Tributária 2027", 40, doc.page.height - 50);

  // =========================================================
  // 1. RESUMO EXECUTIVO
  // =========================================================
  doc.addPage();
  drawSectionHeader(doc, "1. Resumo Executivo");
  doc.fillColor(COLORS.primary).font("Helvetica").fontSize(10)
    .text(
      `Foram escriturados contabilmente ${resumo.qtd_notas} documentos fiscais eletrônicos, totalizando ${fmtMoeda(resumo.receitas)} em saídas e ${fmtMoeda(resumo.despesas)} em entradas. A escrituração seguiu o método das partidas dobradas, com fechamento de Balanço validado matematicamente (Ativo = Passivo + PL).`,
      { align: "justify" }
    );
  doc.moveDown(0.8);

  drawTable(
    doc,
    ["Indicador", "Valor"],
    [
      ["Notas Fiscais Processadas", String(resumo.qtd_notas)],
      ["Receitas (Vendas)", fmtMoeda(resumo.receitas)],
      ["Despesas (Compras)", fmtMoeda(resumo.despesas)],
      ["Contas a Receber", fmtMoeda(resumo.contas_receber)],
      ["Contas a Pagar", fmtMoeda(resumo.contas_pagar)],
      ["Total de Impostos Apurados", fmtMoeda(resumo.impostos_apurados)],
      ["Saldo Bancário Consolidado", fmtMoeda(resumo.saldo_bancario)],
    ],
    [320, 195]
  );

  // =========================================================
  // 2. BALANÇO PATRIMONIAL
  // =========================================================
  drawSectionHeader(doc, "2. Balanço Patrimonial (Sintético)");
  const diff = bal.ativo - bal.passivo - bal.pl;
  drawTable(
    doc,
    ["Grupo", "Saldo (R$)"],
    [
      ["ATIVO", fmtMoeda(bal.ativo)],
      ["(-) PASSIVO", fmtMoeda(bal.passivo)],
      ["(-) PATRIMÔNIO LÍQUIDO", fmtMoeda(bal.pl)],
      ["Verificação (A − P − PL)", Math.abs(diff) < 1 ? "✓ Fecha" : fmtMoeda(diff)],
    ],
    [320, 195]
  );

  // =========================================================
  // 3. DRE por exercício
  // =========================================================
  for (const ex of exs) {
    const linhas = await dre(emp.id, ex.ano);
    drawSectionHeader(doc, `3. DRE — Exercício ${ex.ano}`);
    drawTable(
      doc,
      ["Rubrica", `${ex.ano} (R$)`],
      linhas.map((l) => [l.descricao, fmtMoeda(l.valor)]),
      [320, 195]
    );
  }

  // =========================================================
  // 4. APURAÇÃO DE IMPOSTOS
  // =========================================================
  drawSectionHeader(doc, "4. Apuração de Impostos por Competência");
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(10)
    .text(`Total a recolher no período: ${fmtMoeda(totalPagar)}`, { continued: false });
  doc.moveDown(0.5);
  drawTable(
    doc,
    ["Período", "Imposto", "Débito", "Crédito", "A Pagar"],
    apRows.map((r) => [
      r.periodo, r.imposto, fmtMoeda(r.debito), fmtMoeda(r.credito), fmtMoeda(r.a_pagar),
    ]),
    [70, 130, 105, 105, 105]
  );

  // =========================================================
  // 5. REFORMA TRIBUTÁRIA
  // =========================================================
  drawSectionHeader(doc, "5. Reforma Tributária — EC 132/2023 + LC 214/2025");
  doc.fillColor(COLORS.primary).font("Helvetica").fontSize(9)
    .text("Cronograma oficial aplicado automaticamente pelo sistema:", { align: "left" });
  doc.moveDown(0.3);
  const cronograma = [
    ["2026", "TRANSIÇÃO", "CBS 0,9% + IBS 0,1% (teste, compensáveis com PIS/COFINS)"],
    ["2027", "REFORMA", "PIS/COFINS EXTINTOS. CBS 8,8%. IS (Seletivo) inicia. IPI zerado (exceto ZFM)"],
    ["2029-2032", "TRANSIÇÃO IBS", "IBS cresce; ICMS/ISS decrescem proporcionalmente"],
    ["2033", "REGIME PLENO", "IBS 17,7%. ICMS e ISS EXTINTOS. Sistema novo em vigor pleno"],
  ];
  drawTable(doc, ["Ano", "Fase", "Impacto"], cronograma, [80, 120, 315], ["center", "left", "left"]);

  drawSectionHeader(doc, "5.1. Comparativo de Tributos — Antes × Depois");
  drawTable(
    doc,
    ["Cenário", "Tributos", "Valor Apurado"],
    [
      ["Pré-Reforma (≤2025)", "PIS + COFINS + IPI (extintos em 2027)", fmtMoeda(reforma.pre_reforma.total_extintos)],
      ["Transição 2026", "CBS teste + IBS teste", fmtMoeda(reforma.transicao_2026.cbs_teste + reforma.transicao_2026.ibs_teste)],
      ["Reforma 2027+", "CBS + IBS + IS", fmtMoeda(reforma.reforma_2027.total_novos)],
      ["  › CBS (federal)", "8,8% de referência", fmtMoeda(reforma.reforma_2027.cbs)],
      ["  › IBS (estadual+municipal)", "17,7% em 2033", fmtMoeda(reforma.reforma_2027.ibs)],
      ["  › IS (Imposto Seletivo)", "Tabaco, álcool, veículos etc.", fmtMoeda(reforma.reforma_2027.is)],
    ],
    [180, 220, 115]
  );

  if (anosReforma.length > 0) {
    drawSectionHeader(doc, "5.2. Detalhamento por Exercício");
    drawTable(
      doc,
      ["Ano", "Modo", "Receita", "PIS+COFINS+IPI", "CBS", "IBS", "IS"],
      anosReforma.map((a) => [
        String(a.ano),
        a.modo.replace("_", " "),
        fmtMoeda(a.receita),
        fmtMoeda(a.pis + a.cofins + a.ipi),
        fmtMoeda(a.cbs),
        fmtMoeda(a.ibs),
        fmtMoeda(a.is),
      ]),
      [45, 100, 90, 85, 65, 65, 65]
    );
  }

  // =========================================================
  // 6. AUDITORIA R08
  // =========================================================
  drawSectionHeader(doc, "6. Auditoria R08 — Monofásico PIS/COFINS");
  doc.fillColor(COLORS.primary).font("Helvetica").fontSize(9)
    .text(
      `Foram auditados todos os itens quanto à correta classificação tributária em NCMs sujeitos ao regime monofásico de PIS/COFINS (Lei 10.147/2000, Lei 10.485/2002, Lei 13.097/2015). Total detectado: ${audit.length} divergência(s) crítica(s). Crédito recuperável estimado: ${fmtMoeda(totalCredMono)}.`,
      { align: "justify" }
    );
  doc.moveDown(0.5);
  if (audit.length > 0) {
    drawTable(
      doc,
      ["Nº NF", "NCM", "CST", "Regime", "Valor Nota", "Crédito"],
      audit.slice(0, 25).map((r) => [
        r.numero_nf, r.ncm, `${r.cst_pis}/${r.cst_cof}`, r.regime, fmtMoeda(r.valor_nota), fmtMoeda(r.valor_credito),
      ]),
      [70, 85, 60, 100, 100, 100]
    );
    if (audit.length > 25) {
      doc.fillColor(COLORS.gray).font("Helvetica-Oblique").fontSize(8)
        .text(`... e mais ${audit.length - 25} ocorrência(s). Ver planilha Excel para lista completa.`);
    }
  } else {
    doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(10)
      .text("✓ Nenhuma divergência detectada. Classificação fiscal em conformidade.");
  }

  // =========================================================
  // 7. BALANCETE (top 20)
  // =========================================================
  drawSectionHeader(doc, "7. Balancete Analítico (Principais Contas)");
  drawTable(
    doc,
    ["Código", "Descrição", "Débito", "Crédito", "Saldo"],
    bc.slice(0, 25).map((r) => [
      r.codigo, r.descricao, fmtMoeda(r.debito), fmtMoeda(r.credito), fmtMoeda(r.saldo),
    ]),
    [65, 200, 85, 85, 80]
  );

  // =========================================================
  // 8. FLUXO DE CAIXA MENSAL
  // =========================================================
  if (fluxo.length > 0) {
    drawSectionHeader(doc, "8. Fluxo de Caixa Mensal");
    drawTable(
      doc,
      ["Mês", "Entradas", "Saídas", "Saldo Acumulado"],
      fluxo.slice(-15).map((f) => [f.mes, fmtMoeda(f.entradas), fmtMoeda(f.saidas), fmtMoeda(f.saldo)]),
      [90, 145, 145, 135]
    );
  }

  // =========================================================
  // 9. TOP FORNECEDORES
  // =========================================================
  if (top.length > 0) {
    drawSectionHeader(doc, "9. Top Fornecedores por Volume");
    drawTable(
      doc,
      ["#", "Fornecedor", "Notas", "Total Compras"],
      top.map((t, i) => [String(i + 1), t.participante, String(t.qtd), fmtMoeda(t.total)]),
      [30, 285, 80, 120]
    );
  }

  // =========================================================
  // 10. Considerações Finais + assinatura
  // =========================================================
  drawSectionHeader(doc, "10. Considerações Finais");
  doc.fillColor(COLORS.primary).font("Helvetica").fontSize(9)
    .text(
      "Este parecer foi elaborado a partir da escrituração contábil integral dos documentos fiscais eletrônicos autorizados pela SEFAZ, mediante o método das partidas dobradas com balanço patrimonial validado matematicamente. O sistema aplica as regras tributárias vigentes para o regime informado, inclusive as regras transitórias e definitivas da Reforma Tributária do Consumo (EC 132/2023 e LC 214/2025).",
      { align: "justify" }
    );
  doc.moveDown(0.5);
  doc.text(
    "Trata-se de camada de conferência técnica independente que subsidia — mas NÃO SUBSTITUI — a transmissão das obrigações acessórias oficiais (SPED ECD, SPED EFD ICMS/IPI, SPED EFD Contribuições, DCTFWeb, PGDAS-D, DEFIS, ECF), que permanece sob responsabilidade da contabilidade credenciada da empresa.",
    { align: "justify" }
  );

  doc.moveDown(3);
  doc.strokeColor(COLORS.primary).lineWidth(0.5).moveTo(40, doc.y).lineTo(300, doc.y).stroke();
  doc.moveDown(0.2);
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(10).text("SIGC Contábil Pro");
  doc.fillColor(COLORS.gray).font("Helvetica").fontSize(8).text("Sistema Automatizado de Escrituração Contábil-Fiscal");
  doc.fillColor(COLORS.gray).font("Helvetica-Oblique").fontSize(7)
    .text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`);

  // =========================================================
  // Footer / paginação em todas as páginas
  // =========================================================
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 30;
    doc.strokeColor(COLORS.border).lineWidth(0.3).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
    doc.fillColor(COLORS.gray).font("Helvetica").fontSize(7)
      .text(`SIGC Contábil Pro · ${emp.nome} · CNPJ ${emp.cnpj}`, 40, y + 6);
    doc.text(`Página ${i + 1} de ${range.count}`, 40, y + 6, { align: "right", width: doc.page.width - 80 });
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="parecer_contabil_${Date.now()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
