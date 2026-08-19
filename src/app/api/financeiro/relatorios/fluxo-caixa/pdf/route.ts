import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import PDFDocument from "pdfkit";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/financeiro/relatorios/fluxo-caixa/pdf?meses=6
// Gera um PDF do Fluxo de Caixa (entradas x saidas por mes) da empresa
// ATIVA NA SESSAO. Segue a mesma regra do restante do modulo financeiro:
// NUNCA escolhe empresa sozinho -- exige o cookie empresa_ativa_id, e
// recusa com erro claro se nao houver nenhuma empresa selecionada.
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

    // Agrupa contas a receber (entradas) e contas a pagar (saidas) por mes de
    // vencimento, dos ultimos N meses ate os proximos N meses a partir de hoje.
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

    const fmt = (v: number) =>
      "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const nomesMes: Record<string, string> = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Marco", "04": "Abril",
      "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
      "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
    };
    const formatarMes = (m: string) => {
      const [ano, mesNum] = m.split("-");
      return `${nomesMes[mesNum] ?? mesNum}/${ano}`;
    };

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).font("Helvetica-Bold").text("Relatorio de Fluxo de Caixa", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica").fillColor("#555").text(empresa.nome, { align: "center" });
    doc.text(`CNPJ ${empresa.cnpj}`, { align: "center" });
    doc.fillColor("#000");
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#888").text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { align: "center" });
    doc.fillColor("#000");
    doc.moveDown(1.5);

    const colX = { mes: 50, entradas: 190, saidas: 320, saldo: 450 };
    const rowH = 22;
    let y = doc.y;

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Mes", colX.mes, y);
    doc.text("Entradas", colX.entradas, y);
    doc.text("Saidas", colX.saidas, y);
    doc.text("Saldo Acumulado", colX.saldo, y);
    y += rowH;
    doc.moveTo(50, y - 6).lineTo(545, y - 6).strokeColor("#ccc").stroke();

    doc.font("Helvetica").fontSize(10);
    if (linhas.length === 0) {
      doc.text("Nenhuma movimentacao encontrada no periodo.", 50, y);
      y += rowH;
    }
    for (const linha of linhas) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor("#000").text(formatarMes(linha.mes), colX.mes, y);
      doc.fillColor("#1a7f37").text(fmt(linha.entradas), colX.entradas, y);
      doc.fillColor("#c0392b").text(fmt(linha.saidas), colX.saidas, y);
      doc.fillColor(linha.saldo >= 0 ? "#000" : "#c0392b").text(fmt(linha.saldo), colX.saldo, y);
      doc.fillColor("#000");
      y += rowH;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#ccc").stroke();
    y += 15;

    const totalEntradas = linhas.reduce((a, l) => a + l.entradas, 0);
    const totalSaidas = linhas.reduce((a, l) => a + l.saidas, 0);
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("TOTAL", colX.mes, y);
    doc.fillColor("#1a7f37").text(fmt(totalEntradas), colX.entradas, y);
    doc.fillColor("#c0392b").text(fmt(totalSaidas), colX.saidas, y);
    doc.fillColor("#000").text(fmt(saldoAcumulado), colX.saldo, y);

    doc.end();
    const pdfBuffer = await pdfPromise;

    return new NextResponse(new Uint8Array(pdfBuffer as unknown as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fluxo-caixa-${empresa.cnpj}-${new Date().toISOString().substring(0, 10)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("fluxo-caixa/pdf error:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

