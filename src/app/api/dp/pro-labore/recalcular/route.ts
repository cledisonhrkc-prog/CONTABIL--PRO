import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Recalcula pagamentos de pró-labore já lançados com a fórmula errada
 * (tabela progressiva de CLT) usando a correta (11% fixo). Só mexe em
 * pagamentos PENDENTES desta empresa — nunca em PAGO ou CANCELADO,
 * pra não reescrever histórico do que já saiu do caixa de fato.
 */
export async function POST() {
  return withAuth(async (ctx) => {
    const pendentes = await db.execute(sql`
      SELECT id, valor_bruto FROM pro_labore_pagamentos
      WHERE empresa_id = ${ctx.empresaId} AND status = 'PENDENTE'
    `);

    const recalculados: any[] = [];
    for (const p of pendentes.rows as any[]) {
      const inssResult = await db.execute(sql`
        SELECT dp_calcular_inss_prolabore(${Number(p.valor_bruto)}::numeric, CURRENT_DATE) AS v
      `);
      const novoInss = Number((inssResult.rows[0] as any).v);
      const atual = await db.execute(sql`SELECT valor_irrf FROM pro_labore_pagamentos WHERE id = ${p.id}`);
      const irrfAtual = Number((atual.rows[0] as any).valor_irrf);
      const novoLiquido = Number((Number(p.valor_bruto) - novoInss - irrfAtual).toFixed(2));

      await db.execute(sql`
        UPDATE pro_labore_pagamentos
        SET valor_inss = ${novoInss}, valor_liquido = ${novoLiquido}
        WHERE id = ${p.id}
      `);
      recalculados.push({ id: p.id, valorBruto: p.valor_bruto, novoInss, novoLiquido });
    }

    return { recalculados: recalculados.length, detalhes: recalculados };
  });
}
