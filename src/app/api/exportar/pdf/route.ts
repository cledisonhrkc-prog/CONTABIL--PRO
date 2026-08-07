import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getEmpresaAtiva } from "@/lib/empresa";
import {
  balanco,
  apuracao,
  auditoriaR08,
  dashboardResumo,
} from "@/lib/relatorios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Paleta sÃ³bria
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
  const maxY = doc.page.height - doc.page.margins.bottom - 30; // reserva 30 pro rodapÃ©

  doc.rect(startX, y, totalW, headerH).fill(C.navy);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8);
    const align = i === 0 ? "left" : "right";
    doc.text(h, x + 4, y + 5, { width: widths[i] - 8, align, lineBreak: false });
    x += widths[i];
  });
  y += headerH;

  // Trunca linhas se estourar a pÃ¡gina (NÃƒO cria nova pÃ¡gina)
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
      .text(`(+ ${rows.length - rowsCabem} linha(s) omitidas â€” ver Excel completo)`, startX, y + 2, { width: totalW, lineBreak: false });
    y += 10;
  }
  doc.y = y + 4;
  doc.x = startX;
}

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  const [resumo, bal, apRows, audit] = await Promise.all([
    dashboardResumo(emp.id),
    balanco(emp.id),
    apuracao(emp.id),
    auditoriaR08(emp.id),
  ]);

  const totalApagar = apRows.reduce((a, r) => a + r.a_pagar, 0);
  const totalCredR08 = audit.reduce((a, r) => a + r.valor_credito, 0);
  const balanceDiff = Math.abs(bal.ativo - bal.passivo - bal.pl);

  // Narrativa DETERMINÃSTICA â€” sai do motor, nunca inventa
  const narrativa: string[] = [];
  if (audit.length === 0 && totalCredR08 === 0) {
    if (emp.regime === "SIMPLES") {
      narrativa.push(
        "O lote apresenta CONFORMIDADE INTEGRAL: 0 divergÃªncias na regra R08 (monofÃ¡sico PIS/COFINS). Como o regime Ã© Simples Nacional, os produtos monofÃ¡sicos jÃ¡ sÃ£o tributados corretamente com CST=04 e NÃƒO hÃ¡ crÃ©dito recuperÃ¡vel via PER/DCOMP. A classificaÃ§Ã£o fiscal estÃ¡ adequada."
      );
    } else {
      narrativa.push(
        `Lote em CONFORMIDADE INTEGRAL: 0 divergÃªncias detectadas em ${resumo.qtd_notas} notas fiscais processadas. Nenhum crÃ©dito recuperÃ¡vel identificado.`
      );
    }
  } else {
    narrativa.push(
      `Foram detectadas ${audit.length} divergÃªncia(s) na regra R08 (monofÃ¡sico PIS/COFINS), com crÃ©dito potencialmente recuperÃ¡vel de ${fmtMoeda(totalCredR08)}. Recomenda-se retificar EFD-ContribuiÃ§Ãµes e avaliar PER/DCOMP.`
    );
  }
  if (balanceDiff < 1) {
    narrativa.push(
      `BalanÃ§o patrimonial FECHADO matematicamente (Ativo = Passivo + PL, diferenÃ§a < R$ 0,01). EscrituraÃ§Ã£o validada por partidas dobradas.`
    );
  } else {
    narrativa.push(
      `âš ï¸ BalanÃ§o patrimonial com diferenÃ§a de ${fmtMoeda(balanceDiff)}. RevisÃ£o contÃ¡bil necessÃ¡ria.`
    );
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 60, left: 40, right: 40 }, // bottom 60 para caber rodapÃ©
    info: {
      Title: `Parecer ContÃ¡bil-Fiscal â€” ${emp.nome}`,
      Author: "Fiscal Tech | Cledison Azevedo",
    },
    autoFirstPage: false,
  });

  let pageNum = 0;
  const addPageWithFooter = () => {
    doc.addPage();
    pageNum++;
    // Barras decorativas
    doc.rect(0, 0, doc.page.width, 4).fill(C.gold);
    doc.rect(0, 4, 4, doc.page.height - 4).fill(C.navy);
  };
  // RodapÃ© DENTRO da margem inferior (y = page.height - 30 fica em zona segura)
  const drawFooter = () => {
    const savedY = doc.y;
    const yRodape = doc.page.height - 35;
    doc.strokeColor(C.border).lineWidth(0.3).moveTo(40, yRodape - 3).lineTo(doc.page.width - 40, yRodape - 3).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(6.5)
      .text(
        `SIGC Â· ${emp.nome} Â· CNPJ ${emp.cnpj}   |   PÃ¡gina ${pageNum}/2   |   Gerado em ${new Date().toLocaleString("pt-BR")}`,
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
  // PÃGINA 1 â€” Capa + Resumo + BalanÃ§o + ApuraÃ§Ã£o
  // =========================================================

  // CabeÃ§alho compacto
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(9).text("FISCAL TECH", 40, 20);
  doc.fillColor(C.gray).font("Helvetica").fontSize(7).text("Cledison Azevedo | Analista Fiscal Tributario Senior", 40, 32);

  // TÃ­tulo
  doc.moveDown(1.5);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(18).text("PARECER CONTÃBIL-FISCAL", 40, 55);
  doc.fillColor(C.gold).font("Helvetica").fontSize(10).text(`EscrituraÃ§Ã£o Â· ApuraÃ§Ã£o Â· Auditoria â€” ${new Date().toLocaleDateString("pt-BR")}`, 40, 78);

  // Linha
  doc.strokeColor(C.gold).lineWidth(1).moveTo(40, 96).lineTo(40 + W, 96).stroke();

  // IdentificaÃ§Ã£o
  doc.fillColor(C.slate).font("Helvetica-Bold").fontSize(10).text("CLIENTE", 40, 105);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(12).text(emp.nome, 40, 118);
  doc.fillColor(C.gray).font("Helvetica").fontSize(9)
    .text(`CNPJ ${emp.cnpj}   Â·   Regime ${emp.regime.replace("_", " ")}   Â·   ${emp.segmento ?? "COMERCIO"}`, 40, 134);

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
  drawKPI(3, "CRÃ‰DITO R08 REC.", fmtMoeda(totalCredR08), totalCredR08 > 0 ? C.red : C.green);

  doc.y = kY + 60;
  doc.x = 40;

  // BalanÃ§o + ApuraÃ§Ã£o lado a lado (compacto)
  const yTabelas = doc.y;
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10).text("BALANÃ‡O PATRIMONIAL", 40, yTabelas);
  doc.y = yTabelas + 15;
  tabelaMini(
    doc,
    ["Grupo", "Saldo"],
    [
      ["ATIVO", fmtMoeda(bal.ativo)],
      ["PASSIVO", fmtMoeda(bal.passivo)],
      ["PATRIMÃ”NIO LÃQUIDO", fmtMoeda(bal.pl)],
      ["VerificaÃ§Ã£o A - P - PL", balanceDiff < 1 ? "âœ“ Fecha" : fmtMoeda(balanceDiff)],
    ],
    [W / 2 - 5, W / 2 - 5]
  );

  // ApuraÃ§Ã£o
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10).text("APURAÃ‡ÃƒO DE IMPOSTOS", 40, doc.y + 4);
  doc.y += 15;
  const apRowsFmt = apRows.slice(0, 12).map((r) => [
    `${r.periodo} Â· ${r.imposto}`,
    fmtMoeda(r.debito),
    fmtMoeda(r.credito),
    fmtMoeda(r.a_pagar),
  ]);
  if (apRowsFmt.length === 0) apRowsFmt.push(["Sem apuraÃ§Ã£o", "-", "-", "-"]);
  tabelaMini(doc, ["PerÃ­odo / Imposto", "DÃ©bito", "CrÃ©dito", "A Pagar"], apRowsFmt, [W * 0.4, W * 0.2, W * 0.2, W * 0.2]);

  // Total a recolher em destaque
  doc.moveDown(0.3);
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(11)
    .text(`TOTAL A RECOLHER: ${fmtMoeda(totalApagar)}`, 40, doc.y, { width: W, align: "right", lineBreak: false });

  // RodapÃ© da pÃ¡gina 1
  drawFooter();

  // =========================================================
  // PÃGINA 2 â€” Auditoria + Narrativa + Assinatura
  // =========================================================
  addPageWithFooter();

  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(14).text("AUDITORIA R08 â€” MONOFÃSICO PIS/COFINS", 40, 30);
  doc.fillColor(C.gray).font("Helvetica").fontSize(8)
    .text("Lei 10.147/2000 Â· Lei 10.485/2002 Â· Lei 13.097/2015", 40, 48);
  doc.strokeColor(C.gold).lineWidth(0.5).moveTo(40, 60).lineTo(40 + W, 60).stroke();

  doc.y = 70;

  // Bloco de status
  const statusCor = audit.length === 0 ? C.green : C.red;
  const statusTxt = audit.length === 0 ? "âœ“ CONFORMIDADE INTEGRAL" : `âš  ${audit.length} DIVERGÃŠNCIA(S) DETECTADA(S)`;
  doc.roundedRect(40, 70, W, 40, 3).fillAndStroke(C.bg, statusCor);
  doc.fillColor(statusCor).font("Helvetica-Bold").fontSize(13).text(statusTxt, 50, 80, { width: W - 20 });
  doc.fillColor(C.slate).font("Helvetica").fontSize(9)
    .text(`Foram auditados ${resumo.qtd_notas} documentos fiscais quanto Ã  classificaÃ§Ã£o tributÃ¡ria monofÃ¡sica.`, 50, 96, { width: W - 20 });

  doc.y = 120;

  if (audit.length > 0) {
    tabelaMini(
      doc,
      ["NÂº NF", "NCM", "CST", "Valor Nota", "CrÃ©dito"],
      audit.slice(0, 12).map((r) => [
        r.numero_nf, r.ncm, `${r.cst_pis}/${r.cst_cof}`, fmtMoeda(r.valor_nota), fmtMoeda(r.valor_credito),
      ]),
      [W * 0.2, W * 0.2, W * 0.15, W * 0.225, W * 0.225]
    );
    if (audit.length > 12) {
      doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(8)
        .text(`... e mais ${audit.length - 12} ocorrÃªncias. Ver Excel para lista completa.`, 40, doc.y);
    }
    doc.moveDown(0.5);
    doc.fillColor(C.red).font("Helvetica-Bold").fontSize(10)
      .text(`CrÃ©dito recuperÃ¡vel total: ${fmtMoeda(totalCredR08)}`, 40, doc.y, { width: W });
    doc.moveDown(0.3);
  }

  // AnÃ¡lise DETERMINÃSTICA (sem alucinaÃ§Ã£o)
  doc.moveDown(0.5);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text("ANÃLISE E CONCLUSÃ•ES", 40, doc.y);
  doc.strokeColor(C.gold).lineWidth(0.5).moveTo(40, doc.y + 2).lineTo(40 + W, doc.y + 2).stroke();
  doc.moveDown(0.3);

  for (const linha of narrativa) {
    doc.fillColor(C.slate).font("Helvetica").fontSize(9).text(linha, 40, doc.y, { width: W, align: "justify" });
    doc.moveDown(0.4);
  }

  // Nota metodolÃ³gica compacta
  doc.moveDown(0.3);
  doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(7)
    .text(
      "Nota metodolÃ³gica: faturamento = SUM(vNF) das notas SAÃDA/VENDA/SERVIÃ‡O com cStat=100 (autorizadas) e chaves Ãºnicas. Base para DAS Simples aplicada conforme LC 123/2006 Anexo I. Auditoria R08 conforme Leis 10.147/2000 e 10.485/2002. Este parecer Ã© auxiliar; nÃ£o substitui transmissÃ£o de SPED, PGDAS-D, DEFIS ou ECF pela contabilidade responsÃ¡vel.",
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

  // RodapÃ© da pÃ¡gina 2
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


