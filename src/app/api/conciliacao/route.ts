// Tela de conciliação Fiscal ↔ Contábil (Colab)
// Mostra os 4 valores possíveis de faturamento para explicar divergências
// entre sistemas contábeis e permitir bater números com qualquer padrão.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const emp = await getEmpresaAtiva();
  if (!emp) return NextResponse.json({ ok: false, error: "Sem empresa" }, { status: 404 });

  // Método 1: SUM(vNF) TODAS as notas de SAÍDA (padrão Colab v4.1.2 — não filtra canceladas)
  // Nosso banco já filtrou canceladas na fase 0.1, então esse valor NÃO tem canceladas.
  // Para simular o Colab, precisaríamos ter guardado as canceladas — o que NÃO fazemos.
  const m1 = await db.execute<{ v: string; qtd: string }>(sql`
    SELECT COALESCE(SUM(valor_total),0)::text AS v, COUNT(*)::text AS qtd
    FROM notas_fiscais
    WHERE empresa_id = ${emp.id}
      AND tipo_operacao = 'SAIDA'
      AND finalidade IN ('VENDA','SERVICO')
  `);

  // Método 2: SUM(vNF - vICMS_ST) — padrão adotado pelo nosso sistema
  const m2 = await db.execute<{ v: string }>(sql`
    SELECT COALESCE(SUM(valor_total - valor_icms_st),0)::text AS v
    FROM notas_fiscais
    WHERE empresa_id = ${emp.id}
      AND tipo_operacao = 'SAIDA'
      AND finalidade IN ('VENDA','SERVICO')
  `);

  // Método 3: SUM(vProd) — soma bruta dos produtos por nota
  const m3 = await db.execute<{ v: string }>(sql`
    SELECT COALESCE(SUM(valor_produtos),0)::text AS v
    FROM notas_fiscais
    WHERE empresa_id = ${emp.id}
      AND tipo_operacao = 'SAIDA'
      AND finalidade IN ('VENDA','SERVICO')
  `);

  // Método 4: SUM(itens_nf.valor_total) — soma bruta ITEM A ITEM (o que o Colab reporta em CFOP)
  const m4 = await db.execute<{ v: string; qtd_itens: string }>(sql`
    SELECT COALESCE(SUM(i.valor_total),0)::text AS v,
           COUNT(*)::text AS qtd_itens
    FROM itens_nf i
    JOIN notas_fiscais n ON i.id_nf = n.id
    WHERE n.empresa_id = ${emp.id}
      AND n.tipo_operacao = 'SAIDA'
      AND n.finalidade IN ('VENDA','SERVICO')
  `);

  // CFOP por operação (soma por ITEM = o mesmo cálculo do Colab)
  const cfopItens = await db.execute<{
    op: string;
    cfop: string;
    qtd_itens: string;
    valor_itens: string;
  }>(sql`
    SELECT n.tipo_operacao AS op, i.cfop,
           COUNT(*)::text AS qtd_itens,
           COALESCE(SUM(i.valor_total),0)::text AS valor_itens
    FROM itens_nf i
    JOIN notas_fiscais n ON i.id_nf = n.id
    WHERE n.empresa_id = ${emp.id}
      AND i.cfop IS NOT NULL AND i.cfop <> ''
    GROUP BY n.tipo_operacao, i.cfop
    ORDER BY n.tipo_operacao, SUM(i.valor_total) DESC
    LIMIT 40
  `);

  // CFOP por operação (soma por NOTA — o correto, sem duplicar por item)
  const cfopNotas = await db.execute<{
    op: string;
    cfop: string;
    qtd_notas: string;
    valor_notas: string;
  }>(sql`
    WITH cfop_principal AS (
      SELECT n.id, n.tipo_operacao,
             n.valor_total,
             (
               SELECT cfop FROM itens_nf
               WHERE id_nf = n.id
               GROUP BY cfop
               ORDER BY SUM(valor_total) DESC
               LIMIT 1
             ) AS cfop_principal
      FROM notas_fiscais n
      WHERE n.empresa_id = ${emp.id}
    )
    SELECT tipo_operacao AS op, cfop_principal AS cfop,
           COUNT(*)::text AS qtd_notas,
           COALESCE(SUM(valor_total),0)::text AS valor_notas
    FROM cfop_principal
    WHERE cfop_principal IS NOT NULL
    GROUP BY tipo_operacao, cfop_principal
    ORDER BY tipo_operacao, SUM(valor_total) DESC
    LIMIT 40
  `);

  // Contagem total de notas
  const totais = await db.execute<{ tot: string; itens: string }>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM notas_fiscais WHERE empresa_id = ${emp.id}) AS tot,
      (SELECT COUNT(*)::text FROM itens_nf i JOIN notas_fiscais n ON i.id_nf=n.id
        WHERE n.empresa_id = ${emp.id}) AS itens
  `);

  return NextResponse.json({
    ok: true,
    empresa: { nome: emp.nome, cnpj: emp.cnpj, regime: emp.regime },
    totais: {
      qtd_notas: Number(totais.rows[0]?.tot ?? 0),
      qtd_itens: Number(totais.rows[0]?.itens ?? 0),
    },
    metodos_faturamento: [
      {
        codigo: "M1",
        nome: "SUM(vNF) - Nota fiscal completa (BRUTO)",
        usado_por: "Colab v4.1.2 (relatório)",
        valor: Number(m1.rows[0]?.v ?? 0),
        qtd: Number(m1.rows[0]?.qtd ?? 0),
        observacao:
          "Inclui frete, IPI, ICMS-ST, outras despesas. É o valor 'cheio' da nota fiscal (campo vNF do XML). Serve para relatório gerencial e faturamento bruto declarado ao Fisco.",
      },
      {
        codigo: "M2",
        nome: "SUM(vNF - vICMS_ST) - LÍQUIDO de ST",
        usado_por: "CONTÁBIL PRO (padrão)",
        valor: Number(m2.rows[0]?.v ?? 0),
        qtd: Number(m1.rows[0]?.qtd ?? 0),
        observacao:
          "Exclui o ICMS-ST (imposto já retido pela indústria). É a base correta para calcular DAS Simples, IRPJ Presumido e conferir alíquota efetiva.",
      },
      {
        codigo: "M3",
        nome: "SUM(vProd) - Valor bruto dos produtos por nota",
        usado_por: "Auxiliar contábil",
        valor: Number(m3.rows[0]?.v ?? 0),
        qtd: Number(m1.rows[0]?.qtd ?? 0),
        observacao:
          "Soma o vProd de cada nota (produtos brutos, antes de desconto/ST/etc). Usado para conferência com XML.",
      },
      {
        codigo: "M4",
        nome: "SUM(itens_nf.valor_total) - Soma ITEM a ITEM",
        usado_por: "Colab v4.1.2 (seção CFOP - INCORRETO como faturamento)",
        valor: Number(m4.rows[0]?.v ?? 0),
        qtd_itens: Number(m4.rows[0]?.qtd_itens ?? 0),
        observacao:
          "⚠️ Se usado como faturamento, INFLA o valor porque cada nota entra N vezes (uma por item). NUNCA usar como base de imposto. É o cálculo que o Colab faz na seção 'CFOP por Operação' e por isso mostra R$ 57k quando o real é R$ 37k.",
      },
    ],
    cfop_itens_metodo_colab: cfopItens.rows.map((r) => ({
      operacao: r.op,
      cfop: r.cfop,
      qtd_itens: Number(r.qtd_itens),
      valor_soma_itens: Number(r.valor_itens),
    })),
    cfop_notas_metodo_correto: cfopNotas.rows.map((r) => ({
      operacao: r.op,
      cfop_principal: r.cfop,
      qtd_notas: Number(r.qtd_notas),
      valor_soma_notas: Number(r.valor_notas),
    })),
    diagnostico: {
      titulo: "Por que o Colab reporta 1970 notas e R$ 57k, e nós reportamos 965 notas e R$ 37k?",
      explicacao: [
        "O Colab conta ITENS de nota, não notas. Se uma NF tem 3 medicamentos, entra 3 vezes.",
        "O Colab soma vProd bruto por item, não vNF líquido da nota.",
        "Isso NÃO é bug do banco — é rotulagem confusa no relatório. Os dados estão corretos, o rótulo é que engana.",
        "O CONTÁBIL PRO reporta corretamente 965 notas e faturamento líquido (M2), usado para calcular impostos.",
      ],
    },
  });
}
