import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, AuthError } from "@/lib/auth-financeiro";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { fluxoCaixaCompleto, calcularSaldoTotal } from "@/lib/financeiro";
import PDFDocument from "pdfkit";

/**
 * Relatório de Fluxo de Caixa em PDF.
 * - Sem filtro: mostra os próximos 6 meses (mesmo período da tela).
 * - Com ?mes=AAAA-MM: filtra pra um único mês específico.
 *
 * Reaproveita fluxoCaixaCompleto/calcularSaldoTotal (já validadas na tela),
 * em vez de repetir a consulta com outra lógica — foi isso que causou o
 * bug anterior (PDF só mostrava 1 linha resumida, diferente da tela).
 */
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const mesFiltro = searchParams.get("mes"); // formato AAAA-MM, opcional

    const empresaResult = await db.execute(sql`SELECT nome, cnpj FROM empresas WHERE id = ${ctx.empresaId}`);
    const empresaRow = empresaResult.rows[0] as any;
    const nomeEmpresa = empresaRow?.nome || "Empresa";
    const cnpj = empresaRow?.cnpj || "";

    // Busca 12 meses pra cobrir tanto o padrão (6 meses) quanto qualquer filtro dentro desse período
    const fluxo = await fluxoCaixaCompleto(ctx.empresaId, 12);
    const { total: saldoAtual } = await calcularSaldoTotal(ctx.empresaId);

    const linhas = mesFiltro
      ? fluxo.filter((m: any) => `${m.ano}-${String(m.mesNumero).padStart(2, "0")}` === mesFiltro)
      : fluxo.slice(0, 6);

    if (mesFiltro && linhas.length === 0) {
      return NextResponse.json(
        { error: `Nenhum dado encontrado para a competência ${mesFiltro}. Use o formato AAAA-MM.` },
        { status: 400 }
      );
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text("Relatório de Fluxo de Caixa", { align: "center" });
      doc.fontSize(10).text(nomeEmpresa, { align: "center" });
      doc.text(`CNPJ ${cnpj}`, { align: "center" });
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { align: "center" });
      doc.moveDown(1.5);

      const startX = 40;
      const colWidths = [95, 95, 95, 95, 100];
      const headers = ["Mês", "Entradas", "Saídas", "Projetado", "Saldo Final"];
      let y = doc.y;

      doc.fontSize(10).font("Helvetica-Bold");
      let x = startX;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 18;
      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      y += 6;
      doc.font("Helvetica");

      let totalEntradas = 0;
      let totalSaidas = 0;

      for (const m of linhas as any[]) {
        const entradas = Number(m.entradasConfirmadas) + Number(m.entradasProjetadas);
        const saidas = Number(m.saidasConfirmadas) + Number(m.saidasProjetadas);
        const projetado = entradas - saidas;
        totalEntradas += entradas;
        totalSaidas += saidas;

        x = startX;
        const linha = [
          m.mes,
          `R$ ${entradas.toFixed(2)}`,
          `R$ ${saidas.toFixed(2)}`,
          `R$ ${projetado.toFixed(2)}`,
          `R$ ${Number(m.saldoFinal).toFixed(2)}`,
        ];
        linha.forEach((v, i) => {
          doc.text(v, x, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        y += 18;
      }

      y += 4;
      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      y += 8;

      doc.font("Helvetica-Bold");
      x = startX;
      const totalLinha = [
        "TOTAL",
        `R$ ${totalEntradas.toFixed(2)}`,
        `R$ ${totalSaidas.toFixed(2)}`,
        `R$ ${(totalEntradas - totalSaidas).toFixed(2)}`,
        `R$ ${Number(saldoAtual).toFixed(2)}`,
      ];
      totalLinha.forEach((v, i) => {
        doc.text(v, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });

      doc.moveDown(3);
      doc.fontSize(8).font("Helvetica").text(
        mesFiltro
          ? `Relatório filtrado para a competência ${mesFiltro}.`
          : "Relatório com os próximos 6 meses a partir da data de geração. Adicione ?mes=AAAA-MM na URL para filtrar um único mês específico.",
        { align: "left" }
      );

      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=fluxo-caixa${mesFiltro ? "-" + mesFiltro : ""}.pdf`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao gerar relatório" }, { status: 500 });
  }
}
