import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  BorderStyle,
} from "docx";
import { getEmpresaAtiva } from "@/lib/empresa";
import {
  balanco,
  dre,
  apuracao,
  auditoriaR08,
  dashboardResumo,
} from "@/lib/relatorios";
import { comparativoAntesDepois } from "@/lib/reforma-relatorios";
import { db } from "@/db";
import { exercicios } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fmtMoeda = (v: number) =>
  "R$ " +
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text, bold: true, color: "1F2937", size: 26 }),
    ],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: "B7791F", space: 4 },
    },
  });
}

function p(text: string, opts: { bold?: boolean; italic?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italic,
        color: opts.color,
        size: opts.size ?? 20,
      }),
    ],
  });
}

function cell(text: string, opts: { bold?: boolean; header?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    shading: opts.header
      ? { type: ShadingType.CLEAR, color: "auto", fill: "1F2937" }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold ?? opts.header,
            color: opts.header ? "FFFFFF" : undefined,
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function tabelaSimples(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h) => cell(h, { header: true, align: AlignmentType.CENTER })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((v, i) =>
              cell(v, { align: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT })
            ),
          })
      ),
    ],
  });
}

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  const resumo = await dashboardResumo(emp.id);
  const bal = await balanco(emp.id);
  const apRows = await apuracao(emp.id);
  const audit = await auditoriaR08(emp.id);
  const exs = await db.select().from(exercicios).where(eq(exercicios.empresa_id, emp.id));
  const reforma = await comparativoAntesDepois(emp.id);

  const totalApagar = apRows.reduce((a, r) => a + r.a_pagar, 0);
  const totalCredMono = audit.reduce((a, r) => a + r.valor_credito, 0);

  const children: (Paragraph | Table)[] = [];

  children.push(
    p("PARECER TÉCNICO CONTÁBIL-FISCAL", { bold: true, color: "B7791F", size: 18 }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "RELATÓRIO DE ESCRITURAÇÃO, APURAÇÃO DE IMPOSTOS E AUDITORIA",
          bold: true,
          color: "1F2937",
          size: 32,
        }),
      ],
    }),
    p(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Sistema SIGC Contábil Pro v5.0`, {
      italic: true,
      color: "6B7280",
      size: 16,
    }),

    h1("1. Identificação do Cliente"),
    p(emp.nome, { bold: true, size: 22 }),
    p(`CNPJ: ${emp.cnpj}`),
    p(`Regime Tributário: ${emp.regime}`),
    p(`Segmento: ${emp.segmento ?? "-"}`),

    h1("2. Resumo Executivo"),
    tabelaSimples(
      ["Indicador", "Valor"],
      [
        ["Notas Fiscais Processadas", String(resumo.qtd_notas)],
        ["Receitas (Saídas)", fmtMoeda(resumo.receitas)],
        ["Despesas (Entradas)", fmtMoeda(resumo.despesas)],
        ["Contas a Receber", fmtMoeda(resumo.contas_receber)],
        ["Contas a Pagar", fmtMoeda(resumo.contas_pagar)],
        ["Impostos Apurados", fmtMoeda(resumo.impostos_apurados)],
        ["Saldo Bancário", fmtMoeda(resumo.saldo_bancario)],
      ]
    ),

    h1("3. Balanço Patrimonial (Sintético)"),
    tabelaSimples(
      ["Grupo", "Saldo (R$)"],
      [
        ["ATIVO", fmtMoeda(bal.ativo)],
        ["PASSIVO", fmtMoeda(bal.passivo)],
        ["PATRIMÔNIO LÍQUIDO", fmtMoeda(bal.pl)],
        ["Verificação (A - P - PL)", fmtMoeda(bal.ativo - bal.passivo - bal.pl)],
      ]
    )
  );

  for (const ex of exs) {
    const linhas = await dre(emp.id, ex.ano);
    children.push(
      h1(`4. Demonstração do Resultado do Exercício - ${ex.ano}`),
      tabelaSimples(
        ["DRE", `${ex.ano} (R$)`],
        linhas.map((l) => [l.descricao, fmtMoeda(l.valor)])
      )
    );
  }

  children.push(
    h1("5. Apuração de Impostos"),
    p(`Total a recolher no período: ${fmtMoeda(totalApagar)}`, { bold: true }),
    tabelaSimples(
      ["Período", "Imposto", "Débito", "Crédito", "A Pagar"],
      apRows.map((r) => [r.periodo, r.imposto, fmtMoeda(r.debito), fmtMoeda(r.credito), fmtMoeda(r.a_pagar)])
    )
  );

  if (emp.regime === "SIMPLES") {
    children.push(
      p(
        "Nota metodológica: O DAS foi apurado pela alíquota EFETIVA do Anexo I (LC 123/2006), fórmula (RBT12 × alíquota nominal − parcela a deduzir) / RBT12, com base no RBT12 registrado no cadastro da empresa.",
        { italic: true, size: 16, color: "6B7280" }
      )
    );
  }

  children.push(
    h1("6. Auditoria de Conformidade — Regra R08 (Monofásico PIS/COFINS)"),
    p(
      `Foram identificados ${audit.length} item(ns) com potencial divergência de CST em NCMs monofásicos. Crédito recuperável estimado: ${fmtMoeda(totalCredMono)}.`
    )
  );
  if (audit.length > 0) {
    children.push(
      tabelaSimples(
        ["Nº NF", "NCM", "CST PIS/COFINS", "Regime", "Valor Nota", "Crédito"],
        audit
          .slice(0, 30)
          .map((r) => [
            r.numero_nf,
            r.ncm,
            `${r.cst_pis}/${r.cst_cof}`,
            r.regime,
            fmtMoeda(r.valor_nota),
            fmtMoeda(r.valor_credito),
          ])
      )
    );
  }

  children.push(
    h1("7. Reforma Tributária — EC 132/2023 + LC 214/2025"),
    p(
      "O sistema calcula automaticamente CBS, IBS e Imposto Seletivo (IS) conforme a data de emissão da nota, respeitando o cronograma oficial:",
      { size: 18 }
    ),
    p("• 2026 — CBS 0,9% + IBS 0,1% (fase de teste, compensáveis com PIS/COFINS)", { size: 16 }),
    p("• 2027 — CBS a 8,8% (extingue PIS e COFINS); IPI zerado exceto ZFM; Imposto Seletivo passa a incidir", { size: 16 }),
    p("• 2029-2032 — IBS cresce progressivamente; ICMS e ISS reduzem", { size: 16 }),
    p("• 2033 — IBS a 17,7% (extingue ICMS e ISS). Sistema em regime pleno", { size: 16 }),
    tabelaSimples(
      ["Cenário", "Tributos", "Valor"],
      [
        ["Pré-Reforma (≤2025)", "PIS + COFINS + IPI (extintos)", fmtMoeda(reforma.pre_reforma.total_extintos)],
        ["Transição 2026", "CBS teste + IBS teste", fmtMoeda(reforma.transicao_2026.cbs_teste + reforma.transicao_2026.ibs_teste)],
        ["Reforma 2027+", "CBS + IBS + IS", fmtMoeda(reforma.reforma_2027.total_novos)],
        ["  ↳ CBS", "Contribuição federal", fmtMoeda(reforma.reforma_2027.cbs)],
        ["  ↳ IBS", "Estadual + Municipal", fmtMoeda(reforma.reforma_2027.ibs)],
        ["  ↳ IS", "Imposto Seletivo", fmtMoeda(reforma.reforma_2027.is)],
      ]
    ),
    h1("8. Considerações Finais"),
    p(
      "Este parecer foi elaborado a partir da escrituração contábil integral dos documentos fiscais eletrônicos, mediante método das partidas dobradas com fechamento validado (Ativo = Passivo + PL). Trata-se de camada de conferência independente sobre a escrituração, não substituindo as obrigações acessórias oficiais (SPED Fiscal, SPED Contribuições, PGDAS-D, DEFIS, ECD, ECF).",
      { size: 18 }
    ),
    new Paragraph({ spacing: { after: 400 }, children: [new TextRun("")] }),
    p("Atenciosamente,", { size: 18 }),
    p("SIGC Contábil Pro", { bold: true }),
    p("Sistema Automatizado de Escrituração Contábil-Fiscal", { size: 14, color: "6B7280" })
  );

  const doc = new Document({
    creator: "SIGC Contábil Pro",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [{ children }],
  });

  const buf = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="parecer_contabil_${Date.now()}.docx"`,
    },
  });
}
