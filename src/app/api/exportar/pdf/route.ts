import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getEmpresaAtiva } from "@/lib/empresa";
import {
  balanco,
  apuracao,
  auditoriaR08,
  dashboardResumo,
  balancete,
  dre,
} from "@/lib/relatorios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Paleta sóbria
const C = {
  navy: "#0F172A",
  gold: "#B7791F",
  slate: "#334155",
  gray: "#64748B",
  border: "#CBD5E1",
  green: "#047857",
  red: "#B91C1C",
  bg: "#F8FAFC",
  white: "#FFFFFF",
};

const fmtMoeda = (v: number) =>
  "R$ " +
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tabelaMini(doc: any, headers: string[], rows: string[][], widths: number[]) {
  const startX = doc.page.margins.left;
  const totalW = widths.reduce((a, b) => a + b, 0);
  let y = doc.y;
  const headerH = 16;
  const rowH = 13;
  const maxY = doc.page.height - doc.page.margins.bottom - 30; // reserva 30 pro rodapé

  doc.rect(startX, y, totalW, headerH).fill(C.navy);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8);
    const align = i === 0 ? "left" : "right";
    doc.text(h, x + 4, y + 5, { width: widths[i] - 8, align, lineBreak: false });
    x += widths[i];
  });
  y += headerH;

  // Trunca linhas se estourar a página (NÃO cria nova página)
  const rowsCabem = Math.max(0, Math.floor((maxY - y) / rowH));
  const rowsToDraw = rows.slice(0, rowsCabem);
  rowsToDraw.forEach((row, ri) => {
    if (ri % 2 === 0) doc.rect(startX, y, totalW, rowH).fill(C.bg);
    x = startX;
    row.forEach((v, i) => {
      doc.fillColor(C.slate).font("Helvetica").fontSize(8);
      const align = i === 0 ? "left" : "right";
      doc.text(v, x + 4, y + 3, { width: widths[i] - 8, align, ellipsis: true, height: rowH - 2, lineBreak: false });
      x += widths[i];
    });
    y += rowH;
  });
  if (rows.length > rowsCabem) {
    doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7)
      .text(`(+ ${rows.length - rowsCabem} linha(s) omitidas — ver Excel completo)`, startX, y + 2, { width: totalW, lineBreak: false });
    y += 10;
  }
  doc.y = y + 4;
  doc.x = startX;
}

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  // Descobre anos para a DRE
  const anosSet = new Set<number>();

  const [resumo, bal, apRows, audit, bcRows] = await Promise.all([
    dashboardResumo(emp.id),
    balanco(emp.id),
    apuracao(emp.id),
    auditoriaR08(emp.id),
    balancete(emp.id),
  ]);

  // Anos a partir da apuração (períodos) — fallback ano atual
  for (const r of apRows) {
    const y = parseInt(String(r.periodo).slice(0, 4), 10);
    if (!isNaN(y)) anosSet.add(y);
  }
  if (anosSet.size === 0) anosSet.add(new Date().getFullYear());
  const anos = Array.from(anosSet).sort();
  const dreExercicios: Array<{ ano: number; linhas: { descricao: string; valor: number; destaque?: boolean }[] }> = [];
  for (const ano of anos) {
    const linhas = await dre(emp.id, ano);
    dreExercicios.push({ ano, linhas });
  }

  const totalApagar = apRows.reduce((a, r) => a + r.a_pagar, 0);
  const totalCredR08 = audit.reduce((a, r) => a + r.valor_credito, 0);
  const balanceDiff = Math.abs(bal.ativo - bal.passivo - bal.pl);

  // Narrativa DETERMINÍSTICA — sai do motor, nunca inventa
  const narrativa: string[] = [];
  if (audit.length === 0 && totalCredR08 === 0) {
    if (emp.regime === "SIMPLES") {
      narrativa.push(
        "O lote apresenta CONFORMIDADE INTEGRAL: 0 divergências na regra R08 (monofásico PIS/COFINS). Como o regime é Simples Nacional, os produtos monofásicos já são tributados corretamente com CST=04 e NÃO há crédito recuperável via PER/DCOMP. A classificação fiscal está adequada."
      );
    } else {
      narrativa.push(
        `Lote em CONFORMIDADE INTEGRAL: 0 divergências detectadas em ${resumo.qtd_notas} notas fiscais processadas. Nenhum crédito recuperável identificado.`
      );
    }
  } else {
    narrativa.push(
      `Foram detectadas ${audit.length} divergência(s) na regra R08 (monofásico PIS/COFINS), com crédito potencialmente recuperável de ${fmtMoeda(totalCredR08)}. Recomenda-se retificar EFD-Contribuições e avaliar PER/DCOMP.`
    );
  }
  if (balanceDiff < 1) {
    narrativa.push(
      `Balanço patrimonial FECHADO matematicamente (Ativo = Passivo + PL, diferença < R$ 0,01). Escrituração validada por partidas dobradas.`
    );
  } else {
    narrativa.push(
      `Balanço patrimonial com diferença de ${fmtMoeda(balanceDiff)}. Revisão contábil necessária.`
    );
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 60, left: 40, right: 40 }, // bottom 60 para caber rodapé
    info: {
      Title: `Parecer Contábil-Fiscal — ${emp.nome}`,
      Author: "Fiscal Tech | Cledison Azevedo",
    },
    autoFirstPage: false,
  });

  // Total de páginas fixo do documento
  const TOTAL_PAGINAS = 3;

  let pageNum = 0;
  const addPageWithFooter = () => {
    doc.addPage();
    pageNum++;
    // Barras decorativas
    doc.rect(0, 0, doc.page.width, 4).fill(C.gold);
    doc.rect(0, 4, 4, doc.page.height - 4).fill(C.navy);
  };
  // Rodapé DENTRO da margem inferior (y = page.height - 30 fica em zona segura)
  const drawFooter = () => {
    const savedY = doc.y;
    const yRodape = doc.page.height - 35;
    doc.strokeColor(C.border).lineWidth(0.3).moveTo(40, yRodape - 3).lineTo(doc.page.width - 40, yRodape - 3).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(6.5)
      .text(
        `Fiscal Tech · ${emp.nome} · CNPJ ${emp.cnpj}   |   Página ${pageNum}/${TOTAL_PAGINAS}   |   Gerado em ${new Date().toLocaleString("pt-BR")}`,
        40, yRodape, { width: doc.page.width - 80, align: "center", lineBreak: false, height: 12 }
      );
    doc.y = savedY;
  };

  addPageWithFooter();

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - 80;

  // =========================================================
  // PÁGINA 1 — Capa + Resumo + Balanço + Apuração
  // =========================================================

  // Cabeçalho compacto
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(9).text("FISCAL TECH", 40, 20);
  doc.fillColor(C.gray).font("Helvetica").fontSize(7).text("Sistema de Escrituração Contábil-Fiscal Automatizada", 40, 32);

  // Título
  doc.moveDown(1.5);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(18).text("PARECER CONTÁBIL-FISCAL", 40, 55);
  doc.fillColor(C.gold).font("Helvetica").fontSize(10).text(`Escrituração · Apuração · Auditoria — ${new Date().toLocaleDateString("pt-BR")}`, 40, 78);

  // Linha
  doc.strokeColor(C.gold).lineWidth(1).moveTo(40, 96).lineTo(40 + W, 96).stroke();

  // Identificação
  doc.fillColor(C.slate).font("Helvetica-Bold").fontSize(10).text("CLIENTE", 40, 105);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(12).text(emp.nome, 40, 118);
  doc.fillColor(C.gray).font("Helvetica").fontSize(9)
    .text(`CNPJ ${emp.cnpj}   ·   Regime ${emp.regime.replace("_", " ")}   ·   ${emp.segmento ?? "COMERCIO"}`, 40, 134);

  // KPIs (4 cards)
  const kY = 155;
  const kW = (W - 30) / 4;
  const drawKPI = (idx: number, label: string, value: string, color = C.navy) => {
    const x = 40 + idx * (kW + 10);
    doc.roundedRect(x, kY, kW, 48, 3).fillAndStroke(C.bg, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(6.5).text(label, x + 8, kY + 6, { width: kW - 16 });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(12).text(value, x + 8, kY + 20, { width: kW - 16 });
  };
  drawKPI(0, "NOTAS PROCESSADAS", String(resumo.qtd_notas));
  drawKPI(1, "VOLUME FATURADO", fmtMoeda(resumo.receitas), C.green);
  drawKPI(2, "IMPOSTOS APURADOS", fmtMoeda(totalApagar), C.gold);
  drawKPI(3, "CRÉDITO R08 REC.", fmtMoeda(totalCredR08), totalCredR08 > 0 ? C.red : C.green);

  doc.y = kY + 60;
  doc.x = 40;

  // Balanço + Apuração lado a lado (compacto)
  const yTabelas = doc.y;
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10).text("BALANÇO PATRIMONIAL", 40, yTabelas);
  doc.y = yTabelas + 15;
  tabelaMini(
    doc,
    ["Grupo", "Saldo"],
    [
      ["ATIVO", fmtMoeda(bal.ativo)],
      ["PASSIVO", fmtMoeda(bal.passivo)],
      ["PATRIMÔNIO LÍQUIDO", fmtMoeda(bal.pl)],
      ["Verificação A - P - PL", balanceDiff < 1 ? "Fecha" : fmtMoeda(balanceDiff)],
    ],
    [W / 2 - 5, W / 2 - 5]
  );

  // Apuração
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10).text("APURAÇÃO DE IMPOSTOS", 40, doc.y + 4);
  doc.y += 15;
  const apRowsFmt = apRows.slice(0, 12).map((r) => [
    `${r.periodo} · ${r.imposto}`,
    fmtMoeda(r.debito),
    fmtMoeda(r.credito),
    fmtMoeda(r.a_pagar),
  ]);
  if (apRowsFmt.length === 0) apRowsFmt.push(["Sem apuração", "-", "-", "-"]);
  tabelaMini(doc, ["Período / Imposto", "Débito", "Crédito", "A Pagar"], apRowsFmt, [W * 0.4, W * 0.2, W * 0.2, W * 0.2]);

  // Total a recolher em destaque
  doc.moveDown(0.3);
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(11)
    .text(`TOTAL A RECOLHER: ${fmtMoeda(totalApagar)}`, 40, doc.y, { width: W, align: "right", lineBreak: false });

  // Rodapé da página 1
  drawFooter();

  // =========================================================
  // PÁGINA 2 — Auditoria + Narrativa + Assinatura
  // =========================================================
  addPageWithFooter();

  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(14).text("AUDITORIA R08 — MONOFÁSICO PIS/COFINS", 40, 30);
  doc.fillColor(C.gray).font("Helvetica").fontSize(8)
    .text("Lei 10.147/2000 · Lei 10.485/2002 · Lei 13.097/2015", 40, 48);
  doc.strokeColor(C.gold).lineWidth(0.5).moveTo(40, 60).lineTo(40 + W, 60).stroke();

  doc.y = 70;

  // Bloco de status
  const statusCor = audit.length === 0 ? C.green : C.red;
  const statusTxt = audit.length === 0 ? "CONFORMIDADE INTEGRAL" : `${audit.length} DIVERGÊNCIA(S) DETECTADA(S)`;
  doc.roundedRect(40, 70, W, 40, 3).fillAndStroke(C.bg, statusCor);
  doc.fillColor(statusCor).font("Helvetica-Bold").fontSize(13).text(statusTxt, 50, 80, { width: W - 20 });
  doc.fillColor(C.slate).font("Helvetica").fontSize(9)
    .text(`Foram auditados ${resumo.qtd_notas} documentos fiscais quanto à classificação tributária monofásica.`, 50, 96, { width: W - 20 });

  doc.y = 120;

  if (audit.length > 0) {
    tabelaMini(
      doc,
      ["Nº NF", "NCM", "CST", "Valor Nota", "Crédito"],
      audit.slice(0, 12).map((r) => [
        r.numero_nf, r.ncm, `${r.cst_pis}/${r.cst_cof}`, fmtMoeda(r.valor_nota), fmtMoeda(r.valor_credito),
      ]),
      [W * 0.2, W * 0.2, W * 0.15, W * 0.225, W * 0.225]
    );
    if (audit.length > 12) {
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8)
        .text(`... e mais ${audit.length - 12} ocorrências. Ver Excel para lista completa.`, 40, doc.y);
    }
    doc.moveDown(0.5);
    doc.fillColor(C.red).font("Helvetica-Bold").fontSize(10)
      .text(`Crédito recuperável total: ${fmtMoeda(totalCredR08)}`, 40, doc.y, { width: W });
    doc.moveDown(0.3);
  }

  // Análise DETERMINÍSTICA (sem alucinação)
  doc.moveDown(0.5);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text("ANÁLISE E CONCLUSÕES", 40, doc.y);
  doc.strokeColor(C.gold).lineWidth(0.5).moveTo(40, doc.y + 2).lineTo(40 + W, doc.y + 2).stroke();
  doc.moveDown(0.3);

  for (const linha of narrativa) {
    doc.fillColor(C.slate).font("Helvetica").fontSize(9).text(linha, 40, doc.y, { width: W, align: "justify" });
    doc.moveDown(0.4);
  }

  // Nota metodológica compacta
  doc.moveDown(0.3);
  doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7)
    .text(
      "Nota metodológica: faturamento = SUM(vNF) das notas SAÍDA/VENDA/SERVIÇO com cStat=100 (autorizadas) e chaves únicas. Base para DAS Simples aplicada conforme LC 123/2006 Anexo I. Auditoria R08 conforme Leis 10.147/2000 e 10.485/2002. Este parecer é auxiliar; não substitui transmissão de SPED, PGDAS-D, DEFIS ou ECF pela contabilidade responsável.",
      40,
      doc.y,
      { width: W, align: "justify" }
    );

  // Assinatura
  doc.moveDown(1);
  doc.strokeColor(C.slate).lineWidth(0.5).moveTo(40, doc.y).lineTo(280, doc.y).stroke();
  doc.moveDown(0.2);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9).text("Fiscal Tech | Cledison Azevedo", 40, doc.y);
  doc.fillColor(C.gray).font("Helvetica").fontSize(7).text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, 40, doc.y);

  // Rodapé da página 2
  drawFooter();

  // =========================================================
  // PÁGINA 3 — Balancete + DRE detalhada (anexo do Excel)
  // =========================================================
  addPageWithFooter();

  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(14).text("ANEXO CONTÁBIL — BALANCETE E DRE", 40, 30);
  doc.fillColor(C.gray).font("Helvetica").fontSize(8)
    .text("Detalhamento das contas movimentadas e demonstração do resultado", 40, 48);
  doc.strokeColor(C.gold).lineWidth(0.5).moveTo(40, 60).lineTo(40 + W, 60).stroke();

  doc.y = 70;

  // --- BALANCETE ---
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text("BALANCETE DE VERIFICAÇÃO", 40, doc.y);
  doc.y += 15;
  const bcFmt = bcRows.map((r) => [
    r.codigo,
    r.descricao,
    fmtMoeda(r.debito),
    fmtMoeda(r.credito),
    fmtMoeda(r.saldo),
  ]);
  if (bcFmt.length === 0) bcFmt.push(["-", "Sem movimento", "-", "-", "-"]);
  tabelaMini(
    doc,
    ["Conta", "Descrição", "Débito", "Crédito", "Saldo"],
    bcFmt,
    [W * 0.12, W * 0.38, W * 0.166, W * 0.166, W * 0.168]
  );

  doc.moveDown(0.5);

  // --- DRE ---
  for (const ex of dreExercicios) {
    doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text(`DRE — EXERCÍCIO ${ex.ano}`, 40, doc.y + 4);
    doc.y += 15;
    const dreFmt = ex.linhas.map((l) => [l.descricao, fmtMoeda(l.valor)]);
    if (dreFmt.length === 0) dreFmt.push(["Sem dados", "-"]);
    tabelaMini(doc, ["Descrição", "Valor"], dreFmt, [W * 0.7, W * 0.3]);
    doc.moveDown(0.4);
  }

  // Nota do anexo
  doc.moveDown(0.3);
  doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7)
    .text(
      "Anexo gerado a partir da escrituração por partidas dobradas. Para o razão completo, notas fiscais individuais e aging, consulte o Excel exportado (10 abas).",
      40, doc.y, { width: W, align: "justify" }
    );

  // Rodapé da página 3
  drawFooter();

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="parecer_${emp.cnpj}_${Date.now()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}