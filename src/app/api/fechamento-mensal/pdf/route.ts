import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";
import { gerarFechamentoMensal } from "@/lib/fechamento-mensal";

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
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REGIME_LABEL: Record<string, string> = {
  SIMPLES: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
};

export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const empresaId = Number(searchParams.get("empresa_id"));
  const mes = searchParams.get("mes");

  if (!empresaId || !mes) {
    return NextResponse.json(
      { ok: false, error: "empresa_id e mes (formato AAAA-MM) são obrigatórios." },
      { status: 400 }
    );
  }

  const permitidos = await empresasPermitidasIds(usuario);
  const permitido = permitidos === null || permitidos.includes(empresaId);
  if (!permitido) {
    return NextResponse.json(
      { ok: false, error: "Sem permissão para esta empresa." },
      { status: 403 }
    );
  }

  const dados = await gerarFechamentoMensal(empresaId, mes);
  if (!dados) {
    return NextResponse.json({ ok: false, error: "Empresa não encontrada." }, { status: 404 });
  }

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.on("data", (c: Buffer) => chunks.push(c));

  const W = doc.page.width - 80;
  const [ano, mesNum] = dados.mes.split("-");
  const nomeMes = new Date(Number(ano), Number(mesNum) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Cabeçalho
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(17).text("FECHAMENTO MENSAL", 40, 46);
  doc
    .fillColor(C.gold)
    .font("Helvetica")
    .fontSize(9.5)
    .text(`Referente a ${nomeMes} — gerado em ${new Date().toLocaleDateString("pt-BR")}`, 40, 68);
  doc.strokeColor(C.gold).lineWidth(1).moveTo(40, 84).lineTo(40 + W, 84).stroke();

  doc.fillColor(C.slate).font("Helvetica-Bold").fontSize(9).text("CLIENTE", 40, 91);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text(dados.empresa.nome, 40, 102);
  doc
    .fillColor(C.gray)
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      `CNPJ ${dados.empresa.cnpj}   ·   Regime ${REGIME_LABEL[dados.empresa.regime] ?? dados.empresa.regime}`,
      40,
      116
    );

  // KPIs
  const kY = 138;
  const kW = (W - 30) / 4;
  const drawKPI = (idx: number, label: string, value: string, color = C.navy) => {
    const x = 40 + idx * (kW + 10);
    doc.roundedRect(x, kY, kW, 42, 3).fillAndStroke(C.bg, C.border);
    doc.fillColor(C.gray).font("Helvetica-Bold").fontSize(6).text(label, x + 7, kY + 5, { width: kW - 14 });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(11).text(value, x + 7, kY + 18, { width: kW - 14 });
  };
  drawKPI(0, "NOTAS NO MÊS", String(dados.resumo.qtd_notas));
  drawKPI(1, "RECEITAS", fmtMoeda(dados.resumo.receitas), C.green);
  drawKPI(2, "DESPESAS", fmtMoeda(dados.resumo.despesas), C.red);
  drawKPI(3, "SALDO", fmtMoeda(dados.resumo.saldo), dados.resumo.saldo >= 0 ? C.green : C.red);

  doc.y = kY + 58;
  doc.x = 40;

  // Tabela simples e auto-contida (não depende do PDF completo existente)
  const desenharTabela = (headers: string[], rows: string[][], widths: number[]) => {
    const startX = 40;
    const totalW = widths.reduce((a, b) => a + b, 0);
    let y = doc.y;

    doc.rect(startX, y, totalW, 15).fill(C.navy);
    let x = startX;
    headers.forEach((h, i) => {
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(7.5);
      doc.text(h, x + 4, y + 4, { width: widths[i] - 8, align: i === 0 ? "left" : "right", lineBreak: false });
      x += widths[i];
    });
    y += 15;

    rows.forEach((row, ri) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
      }
      doc.rect(startX, y, totalW, 12).fill(ri % 2 === 0 ? C.white : C.bg);
      x = startX;
      row.forEach((cell, i) => {
        doc.fillColor(C.slate).font("Helvetica").fontSize(7);
        doc.text(cell, x + 4, y + 2.5, { width: widths[i] - 8, align: i === 0 ? "left" : "right", lineBreak: false });
        x += widths[i];
      });
      y += 12;
    });

    doc.y = y + 10;
    doc.x = 40;
  };

  // Notas do mês
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text("1. NOTAS FISCAIS DO MÊS", 40, doc.y);
  doc.y += 6;
  const notasFmt = dados.notas.map((n) => [
    n.numero,
    n.data_emissao,
    n.tipo_operacao === "SAIDA" ? "Venda" : "Compra",
    n.participante || "-",
    fmtMoeda(n.valor_total),
  ]);
  if (notasFmt.length === 0) notasFmt.push(["-", "-", "Sem notas neste mês", "-", "-"]);
  desenharTabela(
    ["Número", "Data", "Tipo", "Participante", "Valor"],
    notasFmt,
    [W * 0.12, W * 0.13, W * 0.13, W * 0.42, W * 0.2]
  );

  // Impostos do mês
  if (doc.y > doc.page.height - 150) doc.addPage();
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(11).text("2. IMPOSTOS DO MÊS", 40, doc.y);
  doc.y += 6;
  const impFmt = dados.impostos_do_mes.map((i) => [i.historico, fmtMoeda(i.valor)]);
  if (impFmt.length === 0) impFmt.push(["Sem lançamento de imposto identificado neste mês", "-"]);
  desenharTabela(["Descrição", "Valor"], impFmt, [W * 0.7, W * 0.3]);

  if (dados.aviso_regime_anual) {
    doc.y += 6;
    doc.roundedRect(40, doc.y, W, 48, 3).fillAndStroke(C.bg, C.gold);
    const yBox = doc.y;
    doc
      .fillColor(C.navy)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("SOBRE IRPJ/CSLL NESTE REGIME", 50, yBox + 6, { width: W - 20 });
    doc
      .fillColor(C.slate)
      .font("Helvetica")
      .fontSize(7)
      .text(dados.aviso_regime_anual, 50, yBox + 17, { width: W - 20, align: "justify" });
    doc.y = yBox + 56;
  }

  doc.end();

  const pdfBuffer: Buffer = await new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fechamento_${dados.empresa.cnpj}_${dados.mes}.pdf"`,
    },
  });
}

