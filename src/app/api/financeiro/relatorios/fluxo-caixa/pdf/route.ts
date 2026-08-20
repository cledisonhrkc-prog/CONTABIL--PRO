import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, AuthError } from "@/lib/auth-financeiro";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { fluxoCaixaCompleto, calcularSaldoTotal, listarContasReceber, listarContasPagar } from "@/lib/financeiro";
import PDFDocument from "pdfkit";

function formatBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatData(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Relatório de Fluxo de Caixa em PDF.
 * - ?empresaId=N  -> gera pra outra empresa (só se o usuário tiver permissão —
 *   mesma checagem de /api/selecionar-empresa; nunca aceita cega).
 * - ?mes=AAAA-MM  -> filtra pra um único mês; sem isso, mostra 6 meses.
 * - Inclui lista detalhada das contas a receber/pagar em aberto, não só o resumo.
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
    const mesFiltro = searchParams.get("mes");
    const empresaIdParam = searchParams.get("empresaId");

    let empresaId = ctx.empresaId;
    if (empresaIdParam) {
      const solicitado = Number(empresaIdParam);
      const usuario = await usuarioAtual();
      if (!usuario) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
      }
      const permitidos = await empresasPermitidasIds(usuario);
      const permitido = permitidos === null || permitidos.includes(solicitado);
      if (!permitido) {
        return NextResponse.json({ error: "Você não tem permissão para esta empresa." }, { status: 403 });
      }
      empresaId = solicitado;
    }

    const empresaResult = await db.execute(sql`SELECT nome, cnpj FROM empresas WHERE id = ${empresaId}`);
    const empresaRow = empresaResult.rows[0] as any;
    if (!empresaRow) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const nomeEmpresa = empresaRow.nome || "Empresa";
    const cnpj = empresaRow.cnpj || "";

    const fluxo = await fluxoCaixaCompleto(empresaId, 12);
    const { total: saldoAtual } = await calcularSaldoTotal(empresaId);

    const linhas = mesFiltro
      ? fluxo.filter((m: any) => `${m.ano}-${String(m.mesNumero).padStart(2, "0")}` === mesFiltro)
      : fluxo.slice(0, 6);

    if (mesFiltro && linhas.length === 0) {
      return NextResponse.json(
        { error: `Nenhum dado encontrado para a competência ${mesFiltro}. Use o formato AAAA-MM.` },
        { status: 400 }
      );
    }

    // Contas em aberto (detalhe, não só o resumo)
    const contasReceberAbertas = await listarContasReceber(empresaId, { status: ["ABERTO", "PARCIAL"], limit: 40 });
    const contasPagarAbertas = await listarContasPagar(empresaId, { status: ["ABERTO", "PARCIAL"], limit: 40 });

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ===== Cabeçalho =====
      doc.fontSize(16).text("Relatório de Fluxo de Caixa", { align: "center" });
      doc.fontSize(10).text(nomeEmpresa, { align: "center" });
      doc.text(`CNPJ ${cnpj}`, { align: "center" });
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, {
        align: "center",
      });
      doc.moveDown(1.5);

      // ===== Tabela: fluxo de caixa mensal =====
      const startX = 40;
      const colWidths = [95, 95, 95, 95, 100];
      const headers = ["Mês", "Entradas", "Saídas", "Projetado", "Saldo Final"];
      let y = doc.y;

      function desenharCabecalho(titulos: string[], larguras: number[]) {
        doc.fontSize(10).font("Helvetica-Bold");
        let xx = startX;
        titulos.forEach((h, i) => {
          doc.text(h, xx, y, { width: larguras[i] });
          xx += larguras[i];
        });
        y += 18;
        doc.moveTo(startX, y).lineTo(startX + larguras.reduce((a, b) => a + b, 0), y).stroke();
        y += 6;
        doc.font("Helvetica");
      }

      desenharCabecalho(headers, colWidths);

      let totalEntradas = 0;
      let totalSaidas = 0;

      for (const m of linhas as any[]) {
        const entradas = Number(m.entradasConfirmadas) + Number(m.entradasProjetadas);
        const saidas = Number(m.saidasConfirmadas) + Number(m.saidasProjetadas);
        const projetado = entradas - saidas;
        totalEntradas += entradas;
        totalSaidas += saidas;

        let x = startX;
        const linha = [m.mes, formatBRL(entradas), formatBRL(saidas), formatBRL(projetado), formatBRL(Number(m.saldoFinal))];
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
      let x = startX;
      const totalLinha = [
        "TOTAL",
        formatBRL(totalEntradas),
        formatBRL(totalSaidas),
        formatBRL(totalEntradas - totalSaidas),
        formatBRL(Number(saldoAtual)),
      ];
      totalLinha.forEach((v, i) => {
        doc.text(v, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      doc.font("Helvetica");
      y += 30;

      // ===== Contas a Receber em aberto (detalhe) =====
      doc.fontSize(12).font("Helvetica-Bold").text("Contas a Receber em Aberto", startX, y);
      y += 20;
      if (contasReceberAbertas.length === 0) {
        doc.fontSize(9).font("Helvetica").text("Nenhuma conta em aberto.", startX, y);
        y += 20;
      } else {
        const colsR = [180, 90, 90, 80];
        desenharCabecalho(["Participante", "Vencimento", "Valor", "Status"], colsR);
        doc.fontSize(9);
        for (const c of contasReceberAbertas as any[]) {
          if (y > 720) {
            doc.addPage();
            y = 40;
          }
          let xx = startX;
          const linha = [
            String(c.participante || "—").slice(0, 32),
            c.vencimento ? formatData(c.vencimento) : "—",
            formatBRL(Number(c.valor) - Number(c.valorPago || 0)),
            String(c.status),
          ];
          linha.forEach((v, i) => {
            doc.text(v, xx, y, { width: colsR[i] });
            xx += colsR[i];
          });
          y += 15;
        }
        y += 10;
      }

      // ===== Contas a Pagar em aberto (detalhe) =====
      if (y > 650) {
        doc.addPage();
        y = 40;
      }
      doc.fontSize(12).font("Helvetica-Bold").text("Contas a Pagar em Aberto", startX, y);
      y += 20;
      if (contasPagarAbertas.length === 0) {
        doc.fontSize(9).font("Helvetica").text("Nenhuma conta em aberto.", startX, y);
        y += 20;
      } else {
        const colsP = [180, 90, 90, 80];
        desenharCabecalho(["Participante", "Vencimento", "Valor", "Status"], colsP);
        doc.fontSize(9);
        for (const c of contasPagarAbertas as any[]) {
          if (y > 720) {
            doc.addPage();
            y = 40;
          }
          let xx = startX;
          const linha = [
            String(c.participante || "—").slice(0, 32),
            c.vencimento ? formatData(c.vencimento) : "—",
            formatBRL(Number(c.valor) - Number(c.valorPago || 0)),
            String(c.status),
          ];
          linha.forEach((v, i) => {
            doc.text(v, xx, y, { width: colsP[i] });
            xx += colsP[i];
          });
          y += 15;
        }
      }

      doc.fontSize(8).font("Helvetica").text(
        mesFiltro
          ? `Fluxo de caixa filtrado para a competência ${mesFiltro}. Lista de contas em aberto limitada a 40 itens por seção.`
          : "Fluxo de caixa com os próximos 6 meses. Lista de contas em aberto limitada a 40 itens por seção.",
        startX,
        750,
        { width: 500 }
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
