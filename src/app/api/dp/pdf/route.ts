import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, AuthError } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import PDFDocument from "pdfkit";

function formatBRL(v: number | string): string {
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatData(v: string): string {
  return new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Gera PDF de: holerite (folha CLT), pró-labore, férias ou rescisão.
 * ?tipo=holerite|prolabore|ferias|rescisao&id=N
 * Reaproveita o mesmo padrão já validado no relatório de fluxo de caixa
 * (pdfkit, Promise<Buffer>, new Uint8Array no NextResponse).
 */
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");
    const id = Number(searchParams.get("id"));
    if (!tipo || !id) throw new Error("Parâmetros obrigatórios: tipo, id");

    const empresaResult = await db.execute(sql`SELECT nome, cnpj FROM empresas WHERE id = ${ctx.empresaId}`);
    const empresa = empresaResult.rows[0] as any;
    const nomeEmpresa = empresa?.nome || "Empresa";
    const cnpjEmpresa = empresa?.cnpj || "";

    let titulo = "";
    let linhas: { label: string; valor: string; destaque?: boolean }[] = [];
    let colaboradorNome = "";
    let colaboradorCpf = "";
    let filename = "documento.pdf";

    if (tipo === "holerite") {
      const r = await db.execute(sql`
        SELECT h.*, c.nome_completo, c.cpf FROM dp_holerites h
        JOIN colaboradores c ON c.id = h.colaborador_id
        WHERE h.id = ${id} AND h.empresa_id = ${ctx.empresaId}
      `);
      const h = r.rows[0] as any;
      if (!h) throw new Error("Holerite não encontrado nesta empresa.");
      colaboradorNome = h.nome_completo;
      colaboradorCpf = h.cpf;
      titulo = `Holerite — Competência ${h.competencia}`;
      filename = `holerite-${h.competencia}.pdf`;
      linhas = [
        { label: "Salário base", valor: formatBRL(h.salario_base) },
        { label: "Total de proventos", valor: formatBRL(h.total_proventos) },
        { label: "INSS", valor: formatBRL(h.valor_inss) },
        { label: "IRRF", valor: formatBRL(h.valor_irrf) },
        { label: "Total de descontos", valor: formatBRL(h.total_descontos) },
        { label: "FGTS do mês (informativo)", valor: formatBRL(h.fgts_mes) },
        { label: "LÍQUIDO A RECEBER", valor: formatBRL(h.total_liquido), destaque: true },
      ];
    } else if (tipo === "prolabore") {
      const r = await db.execute(sql`
        SELECT p.*, c.nome_completo, c.cpf FROM pro_labore_pagamentos p
        JOIN colaboradores c ON c.id = p.colaborador_id
        WHERE p.id = ${id} AND p.empresa_id = ${ctx.empresaId}
      `);
      const p = r.rows[0] as any;
      if (!p) throw new Error("Pagamento de pró-labore não encontrado nesta empresa.");
      colaboradorNome = p.nome_completo;
      colaboradorCpf = p.cpf;
      titulo = `Recibo de Pró-labore — Competência ${p.competencia}`;
      filename = `prolabore-${p.competencia}.pdf`;
      linhas = [
        { label: "Valor bruto", valor: formatBRL(p.valor_bruto) },
        { label: "INSS (11% fixo, contribuinte individual)", valor: formatBRL(p.valor_inss) },
        { label: "IRRF", valor: formatBRL(p.valor_irrf) },
        { label: "Status", valor: p.status },
        { label: "LÍQUIDO A RECEBER", valor: formatBRL(p.valor_liquido), destaque: true },
      ];
    } else if (tipo === "ferias") {
      const r = await db.execute(sql`
        SELECT f.*, c.nome_completo, c.cpf FROM dp_ferias f
        JOIN colaboradores c ON c.id = f.colaborador_id
        WHERE f.id = ${id} AND f.empresa_id = ${ctx.empresaId}
      `);
      const f = r.rows[0] as any;
      if (!f) throw new Error("Registro de férias não encontrado nesta empresa.");
      colaboradorNome = f.nome_completo;
      colaboradorCpf = f.cpf;
      titulo = `Recibo de Férias — ${formatData(f.data_inicio_gozo)} a ${formatData(f.data_fim_gozo)}`;
      filename = `ferias-${f.id}.pdf`;
      linhas = [
        { label: "Dias de gozo", valor: String(f.dias_gozo) },
        { label: "Valor das férias", valor: formatBRL(f.valor_ferias) },
        { label: "1/3 constitucional", valor: formatBRL(f.valor_terco) },
        ...(f.abono_pecuniario
          ? [
              { label: "Abono pecuniário (isento)", valor: formatBRL(f.valor_abono) },
              { label: "1/3 sobre abono (isento)", valor: formatBRL(f.valor_terco_abono) },
            ]
          : []),
        { label: "INSS", valor: formatBRL(f.valor_inss) },
        { label: "IRRF", valor: formatBRL(f.valor_irrf) },
        { label: "LÍQUIDO A RECEBER", valor: formatBRL(f.total_liquido), destaque: true },
      ];
    } else if (tipo === "rescisao") {
      const r = await db.execute(sql`
        SELECT rs.*, c.nome_completo, c.cpf FROM dp_rescisoes rs
        JOIN colaboradores c ON c.id = rs.colaborador_id
        WHERE rs.id = ${id} AND rs.empresa_id = ${ctx.empresaId}
      `);
      const rs = r.rows[0] as any;
      if (!rs) throw new Error("Rescisão não encontrada nesta empresa.");
      colaboradorNome = rs.nome_completo;
      colaboradorCpf = rs.cpf;
      titulo = `Termo de Rescisão — Demissão em ${formatData(rs.data_demissao)}`;
      filename = `rescisao-${rs.id}.pdf`;
      linhas = [
        { label: "Motivo", valor: rs.motivo },
        { label: "Saldo de salário", valor: formatBRL(rs.saldo_salario) },
        { label: "Aviso prévio indenizado (isento)", valor: formatBRL(rs.aviso_previo_indenizado) },
        { label: "Férias proporcionais", valor: formatBRL(rs.ferias_proporcionais) },
        { label: "1/3 sobre férias proporcionais", valor: formatBRL(rs.terco_ferias_proporcionais) },
        { label: "13º proporcional", valor: formatBRL(rs.decimo_terceiro_proporcional) },
        { label: "Multa de 40% do FGTS (isenta)", valor: formatBRL(rs.multa_fgts) },
        { label: "Total de proventos", valor: formatBRL(rs.total_proventos) },
        { label: "INSS", valor: formatBRL(rs.valor_inss) },
        { label: "IRRF", valor: formatBRL(rs.valor_irrf) },
        { label: "LÍQUIDO A RECEBER", valor: formatBRL(rs.total_liquido), destaque: true },
      ];
    } else {
      throw new Error("Tipo inválido. Use: holerite, prolabore, ferias ou rescisao.");
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).font("Helvetica-Bold").text(titulo, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text(nomeEmpresa, { align: "center" });
      doc.text(`CNPJ ${cnpjEmpresa}`, { align: "center" });
      doc.moveDown(1);

      doc.fontSize(11).font("Helvetica-Bold").text("Colaborador:", { continued: true }).font("Helvetica").text(` ${colaboradorNome}`);
      doc.font("Helvetica-Bold").text("CPF:", { continued: true }).font("Helvetica").text(` ${colaboradorCpf}`);
      doc.moveDown(1);

      doc.strokeColor("#cccccc").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      for (const linha of linhas) {
        if (linha.destaque) {
          doc.moveDown(0.3);
          doc.strokeColor("#cccccc").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.3);
          doc.fontSize(12).font("Helvetica-Bold");
        } else {
          doc.fontSize(10).font("Helvetica");
        }
        const y = doc.y;
        doc.text(linha.label, 50, y, { width: 350 });
        doc.text(linha.valor, 400, y, { width: 145, align: "right" });
        doc.moveDown(0.4);
      }

      doc.moveDown(2);
      doc.fontSize(8).font("Helvetica").fillColor("#888888").text(
        `Documento gerado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} — Contábil Pro.`,
        { align: "center" }
      );

      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao gerar PDF" }, { status: 400 });
  }
}
