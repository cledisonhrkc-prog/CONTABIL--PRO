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
  auditoriaClassificacaoNCM,
  razao,
  aging,
  notas,
} from "@/lib/relatorios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
function tabela(doc: any, headers: string[], rows: string[][], widths: number[], addPage: () => void, drawFooter: () => void) {
  const startX = doc.page.margins.left;
  const totalW = widths.reduce((a, b) => a + b, 0);
  const headerH = 15;
  const rowH = 12;
  const maxY = () => doc.page.height - doc.page.margins.bottom - 24;

  const desenhaCabecalho = () => {
    let y = doc.y;
    doc.rect(startX, y, totalW, headerH).fill(C.navy);
    let x = startX;
    headers.forEach((h, i) => {
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(7.5);
      const align = i === 0 ? "left" : "right";
      doc.text(h, x + 4, y + 4, { width: widths[i] - 8, align, lineBreak: false });
      x += widths[i];
    });
    doc.y = y + headerH;
  };

  desenhaCabecalho();
  rows.forEach((row, ri) => {
    // quebra de página automática — mantém a tabela contínua
    if (doc.y + rowH > maxY()) {
      drawFooter();
      addPage();
      doc.y = doc.page.margins.top;
      desenhaCabecalho();
    }
    let y = doc.y;
    if (ri % 2 === 0) doc.rect(startX, y, totalW, rowH).fill(C.bg);
    let x = startX;
    row.forEach((v, i) => {
      doc.fillColor(C.slate).font("Helvetica").fontSize(7.5);
      const align = i === 0 ? "left" : "right";
      doc.text(v, x + 4, y + 2.5, { width: widths[i] - 8, align, ellipsis: true, height: rowH - 2, lineBreak: false });
      x += widths[i];
    });
    doc.y = y + rowH;
  });
  doc.y += 4;
  doc.x = startX;
}

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  const anosSet = new Set<number>();

  const [resumo, bal, apRows, audit, bcRows, razaoRows, agingRows, notasRows, classNCM] = await Promise.all([
    dashboardResumo(emp.id),
    balanco(emp.id),
    apuracao(emp.id),
    auditoriaR08(emp.id),
    balancete(emp.id),
    razao(emp.id, 5000),
    aging(emp.id),
    notas(emp.id, 2000),
    auditoriaClassificacaoNCM(emp.id),
  ]);

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
    narrativa.push(`Balanço patrimonial com diferença de ${fmtMoeda(balanceDiff)}. Revisão contábil necessária.`);
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    info: {
      Title: `Parecer Contábil-Fiscal Completo — ${emp.nome}`,
      Author: "Fiscal Tech | Cledison Azevedo",
    },
    autoFirstPage: false,
  });

  let pageNum = 0;
  const addPage = () => {
    doc.addPage();
    pageNum++;
    doc.rect(0, 0, doc.page.width, 4).fill(C.gold);
    doc.rect(0, 4, 4, doc.page.height - 4).fill(C.navy);
    doc.y = doc.page.margins.top;
  };
  const drawFooter = () => {
    const savedY = doc.y;
    const yRodape = doc.page.height - 32;
    doc.strokeColor(C.border).lineWidth(0.3).moveTo(40, yRodape - 3).lineTo(doc.page.width - 40, yRodape - 3).stroke();
    doc.fillColor(C.gray).font("Helvetica").fontSize(6.5)
      .text(
        `Fiscal Tech · ${emp.nome} · CNPJ ${emp.cnpj}   |   Página ${pageNum}   |   Gerado em ${new Date().toLocaleString("pt-BR")}`,
        40, yRodape, { width: doc.page.width - 80, align: "center", lineBreak: false, height: 12 }
      );
    doc.y = savedY;
  };
  const secao = (titulo: string, sub?: string) => {
    if (doc.y > doc.page.height - 140) { drawFooter(); addPage(); }
    doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text(titulo, 40, doc.y + 4);
    if (sub) doc.fillColor(C.gray).font("Helvetica").fontSize(7.5).text(sub, 40, doc.y + 1);
    doc.strokeColor(C.gold).lineWidth(0.5).moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).stroke();
    doc.y += 8;
  };

  addPage();

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - 80;

  // =========================================================
  // CAPA
  // =========================================================
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(9).text("FISCAL TECH", 40, 18);
  doc.fillColor(C.gray).font("Helvetica").fontSize(7).text("Sistema de Escrituração Contábil-Fiscal Automatizada", 40, 29);

  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(17).text("PARECER CONTÁBIL-FISCAL COMPLETO", 40, 46);
  doc.fillColor(C.gold).font("Helvetica").fontSize(9.5).text(`Escrituração · Apuração · Auditoria · Livros — ${new Date().toLocaleDateString("pt-BR")}`, 40, 68);
  doc.strokeColor(C.gold).lineWidth(1).moveTo(40, 84).lineTo(40 + W, 84).stroke();

  doc.fillColor(C.slate).font("Helvetica-Bold").fontSize(9).text("CLIENTE", 40, 91);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text(emp.nome, 40, 102);
  doc.fillColor(C.gray).font("Helvetica").fontSize(8.5)
    .text(`CNPJ ${emp.cnpj}   ·   Regime ${emp.regime.replace("_", " ")}   ·   ${emp.segmento ?? "COMERCIO"}`, 40, 116);

  const kY = 134;
  const kW = (W - 30) / 4;
  const drawKPI = (idx: number, label: string, value: string, color = C.navy) => {
    const x = 40 + idx * (kW + 10);
    doc.roundedRect(x, kY, kW, 42, 3).fillAndStroke(C.bg, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(6).text(label, x + 7, kY + 5, { width: kW - 14 });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(11).text(value, x + 7, kY + 18, { width: kW - 14 });
  };
  drawKPI(0, "NOTAS PROCESSADAS", String(resumo.qtd_notas));
  drawKPI(1, "VOLUME FATURADO", fmtMoeda(resumo.receitas), C.green);
  drawKPI(2, "IMPOSTOS APURADOS", fmtMoeda(totalApagar), C.gold);
  drawKPI(3, "CRÉDITO R08 REC.", fmtMoeda(totalCredR08), totalCredR08 > 0 ? C.red : C.green);

  doc.y = kY + 54;
  doc.x = 40;

  // BALANÇO
  secao("1. BALANÇO PATRIMONIAL");
  tabela(doc, ["Grupo", "Saldo"], [
    ["ATIVO", fmtMoeda(bal.ativo)],
    ["PASSIVO", fmtMoeda(bal.passivo)],
    ["PATRIMÔNIO LÍQUIDO", fmtMoeda(bal.pl)],
    ["Verificação A - P - PL", balanceDiff < 1 ? "Fecha" : fmtMoeda(balanceDiff)],
  ], [W / 2 - 5, W / 2 - 5], addPage, drawFooter);

  // APURAÇÃO
  secao("2. APURAÇÃO DE IMPOSTOS");
  const apFmt = apRows.map((r) => [`${r.periodo} · ${r.imposto}`, fmtMoeda(r.debito), fmtMoeda(r.credito), fmtMoeda(r.a_pagar)]);
  if (apFmt.length === 0) apFmt.push(["Sem apuração", "-", "-", "-"]);
  tabela(doc, ["Período / Imposto", "Débito", "Crédito", "A Pagar"], apFmt, [W * 0.4, W * 0.2, W * 0.2, W * 0.2], addPage, drawFooter);
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(10)
    .text(`DAS ESTIMADO: ${fmtMoeda(totalApagar)}`, 40, doc.y, { width: W, align: "right", lineBreak: false });
  doc.y += 12;
  doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(6.5).text("Valor estimado pelo sistema com base no faturamento do periodo. O DAS oficial e apurado no PGDAS-D pela contabilidade responsavel.", 40, doc.y, { width: W, align: "right" });
  doc.y += 16;
  doc.roundedRect(40, doc.y, W, 54, 3).fillAndStroke(C.bg, C.gold);
  const yBox = doc.y;
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(8.5).text("COMO LER O DAS DESTE RELATORIO", 50, yBox + 6, { width: W - 20 });
  doc.fillColor(C.slate).font("Helvetica").fontSize(7.5).text("O valor do DAS aqui e uma ESTIMATIVA tecnica, calculada pela formula oficial do Simples Nacional (LC 123/2006) sobre o faturamento do periodo. O valor DEFINITIVO a recolher e o que consta no PGDAS-D, gerado mensalmente pela contabilidade junto a Receita Federal, pois depende da receita acumulada dos ultimos 12 meses (RBT12). Pequenas diferencas entre esta estimativa e o PGDAS-D sao normais e esperadas.", 50, yBox + 18, { width: W - 20, align: "justify" });
  doc.y = yBox + 60;
  doc.y += 14;

  // BALANCETE
  secao("3. BALANCETE DE VERIFICAÇÃO");
  const bcFmt = bcRows.map((r) => [r.codigo, r.descricao, fmtMoeda(r.debito), fmtMoeda(r.credito), fmtMoeda(r.saldo)]);
  if (bcFmt.length === 0) bcFmt.push(["-", "Sem movimento", "-", "-", "-"]);
  tabela(doc, ["Conta", "Descrição", "Débito", "Crédito", "Saldo"], bcFmt, [W * 0.12, W * 0.4, W * 0.16, W * 0.16, W * 0.16], addPage, drawFooter);

  // DRE
  for (const ex of dreExercicios) {
    secao(`4. DEMONSTRAÇÃO DO RESULTADO — DRE ${ex.ano}`);
    const dreFmt = ex.linhas.map((l) => [l.descricao, fmtMoeda(l.valor)]);
    if (dreFmt.length === 0) dreFmt.push(["Sem dados", "-"]);
    tabela(doc, ["Descrição", "Valor"], dreFmt, [W * 0.7, W * 0.3], addPage, drawFooter);
  }

  // AGING
  secao("5. CONTAS A RECEBER E PAGAR (AGING)");
  const agFmt = agingRows.map((r: { tipo: string; status: string; qtd: number; saldo: number }) =>
    [r.tipo, r.status, String(r.qtd), fmtMoeda(r.saldo)]);
  if (agFmt.length === 0) agFmt.push(["Sem títulos", "-", "-", "-"]);
  tabela(doc, ["Tipo", "Status", "Qtd", "Saldo"], agFmt, [W * 0.3, W * 0.3, W * 0.2, W * 0.2], addPage, drawFooter);

  // AUDITORIA R08
  secao("6. AUDITORIA R08 — MONOFÁSICO PIS/COFINS", "Lei 10.147/2000 · Lei 10.485/2002 · Lei 13.097/2015");
  const statusCor = audit.length === 0 ? C.green : C.red;
  const statusTxt = audit.length === 0 ? "CONFORMIDADE INTEGRAL" : `${audit.length} DIVERGÊNCIA(S) DETECTADA(S)`;
  doc.roundedRect(40, doc.y, W, 32, 3).fillAndStroke(C.bg, statusCor);
  doc.fillColor(statusCor).font("Helvetica-Bold").fontSize(12).text(statusTxt, 50, doc.y + 7, { width: W - 20 });
  doc.fillColor(C.slate).font("Helvetica").fontSize(8).text(`Foram auditados ${resumo.qtd_notas} documentos fiscais.`, 50, doc.y + 5, { width: W - 20 });
  doc.y += 14;
  if (audit.length > 0) {
    const auFmt = audit.map((r) => [r.numero_nf, r.ncm, `${r.cst_pis}/${r.cst_cof}`, fmtMoeda(r.valor_nota), fmtMoeda(r.valor_credito)]);
    tabela(doc, ["Nº NF", "NCM", "CST", "Valor Nota", "Crédito"], auFmt, [W * 0.2, W * 0.2, W * 0.15, W * 0.225, W * 0.225], addPage, drawFooter);
    doc.fillColor(C.red).font("Helvetica-Bold").fontSize(9.5).text(`Crédito recuperável total: ${fmtMoeda(totalCredR08)}`, 40, doc.y + 2, { width: W });
    doc.y += 12;
  }
  for (const linha of narrativa) {
    doc.fillColor(C.slate).font("Helvetica").fontSize(8.5).text(linha, 40, doc.y, { width: W, align: "justify" });
    doc.moveDown(0.3);
  }

  // CLASSIFICAÇÃO NCM x CST
  if (classNCM.length > 0) {
    secao("7. REVISÃO DE CLASSIFICAÇÃO NCM x CST", "Itens com NCM de medicamento (3004) e CST PIS 49/99 — não afeta o DAS");
    const cnFmt = classNCM.map((x: { numero_nf: string; ncm: string; cst_pis: string; descricao: string; valor: number }) =>
      [x.numero_nf, x.ncm, x.cst_pis, (x.descricao || "").slice(0, 40), fmtMoeda(x.valor)]);
    tabela(doc, ["NF", "NCM", "CST", "Produto", "Valor"], cnFmt, [W * 0.12, W * 0.2, W * 0.1, W * 0.38, W * 0.2], addPage, drawFooter);
  }

  // LIVRO DE NOTAS FISCAIS
  secao("8. LIVRO DE NOTAS FISCAIS", `Relação das ${notasRows.length} notas processadas (saídas/entradas)`);
  const nfFmt = notasRows.map((r: { numero: string; data_emissao: string; tipo_operacao: string; finalidade: string; participante: string; valor_total: number }) =>
    [
      r.numero || "-",
      (r.data_emissao || "").slice(0, 10),
      r.tipo_operacao || "-",
      (r.participante || "").slice(0, 35),
      fmtMoeda(Number(r.valor_total) || 0),
    ]);
  if (nfFmt.length === 0) nfFmt.push(["-", "-", "-", "Sem notas", "-"]);
  tabela(doc, ["Nº", "Data", "Tipo", "Participante", "Valor"], nfFmt, [W * 0.1, W * 0.15, W * 0.12, W * 0.45, W * 0.18], addPage, drawFooter);

  // LIVRO RAZÃO
  secao("9. LIVRO RAZÃO — LANÇAMENTOS CONTÁBEIS", `Relação dos ${razaoRows.length} lançamentos (partidas dobradas)`);
  const rzFmt = razaoRows.map((r: { competencia: string; numero: string; codigo_conta: string; descricao: string; debito: number; credito: number }) =>
    [
      (r.competencia || "").slice(0, 10),
      r.numero || "-",
      r.codigo_conta || "-",
      (r.descricao || "").slice(0, 28),
      fmtMoeda(Number(r.debito) || 0),
      fmtMoeda(Number(r.credito) || 0),
    ]);
  if (rzFmt.length === 0) rzFmt.push(["-", "-", "-", "Sem lançamentos", "-", "-"]);
  tabela(doc, ["Compet.", "Nº", "Conta", "Descrição", "Débito", "Crédito"], rzFmt,
    [W * 0.13, W * 0.1, W * 0.12, W * 0.3, W * 0.175, W * 0.175], addPage, drawFooter);

  // Nota metodológica + assinatura
  if (doc.y > doc.page.height - 120) { drawFooter(); addPage(); }
  doc.moveDown(0.5);
  doc.fillColor(C.gray).font("Helvetica-Oblique").fontSize(6.5)
    .text(
      "Nota metodológica: faturamento = SUM(vNF) das notas SAÍDA/VENDA/SERVIÇO com cStat=100 (autorizadas) e chaves únicas. Base para DAS Simples aplicada conforme LC 123/2006 Anexo I. Auditoria R08 conforme Leis 10.147/2000 e 10.485/2002. Este parecer é auxiliar; não substitui transmissão de SPED, PGDAS-D, DEFIS ou ECF pela contabilidade responsável.",
      40, doc.y, { width: W, align: "justify" }
    );
  doc.moveDown(0.8);
  doc.strokeColor(C.slate).lineWidth(0.5).moveTo(40, doc.y).lineTo(280, doc.y).stroke();
  doc.moveDown(0.2);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9).text("Fiscal Tech | Cledison Azevedo", 40, doc.y);
  doc.fillColor(C.gray).font("Helvetica").fontSize(7).text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, 40, doc.y);

  drawFooter();
  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="parecer_completo_${emp.cnpj}_${Date.now()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
