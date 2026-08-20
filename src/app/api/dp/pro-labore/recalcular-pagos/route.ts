import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Recalcula pagamentos JÁ MARCADOS COMO PAGOS, com a fórmula errada
 * (tabela progressiva de CLT). Diferente de /recalcular (que só mexe
 * em PENDENTE), essa rota é uma ação explícita e deliberada — só usar
 * quando se sabe que o "pago" é dado de teste, não movimentação real
 * já conciliada com o banco. Deixa rastro na observação, não apaga
 * silenciosamente o valor anterior.
 */
export async function POST() {
  return withAuth(async (ctx) => {
    const pagos = await db.execute(sql`
      SELECT id, valor_bruto, valor_inss AS inss_antigo, valor_irrf, observacoes
      FROM pro_labore_pagamentos
      WHERE empresa_id = ${ctx.empresaId} AND status = 'PAGO'
    `);

    const recalculados: any[] = [];
    for (const p of pagos.rows as any[]) {
      const inssResult = await db.execute(sql`
        SELECT dp_calcular_inss_prolabore(${Number(p.valor_bruto)}::numeric, CURRENT_DATE) AS v
      `);
      const novoInss = Number((inssResult.rows[0] as any).v);
      const inssAntigo = Number(p.inss_antigo);

      if (Math.abs(novoInss - inssAntigo) < 0.01) continue; // já está certo, não mexe

      const novoLiquido = Number((Number(p.valor_bruto) - novoInss - Number(p.valor_irrf)).toFixed(2));
      const novaObs = `${p.observacoes ? p.observacoes + " | " : ""}INSS recalculado de R$${inssAntigo.toFixed(2)} para R$${novoInss.toFixed(2)} em ${new Date().toISOString().slice(0, 10)} (correção: pró-labore usa 11% fixo, não tabela CLT).`;

      await db.execute(sql`
        UPDATE pro_labore_pagamentos
        SET valor_inss = ${novoInss}, valor_liquido = ${novoLiquido}, observacoes = ${novaObs}
        WHERE id = ${p.id}
      `);
      recalculados.push({ id: p.id, valorBruto: p.valor_bruto, inssAntigo, novoInss, novoLiquido });
    }

    return { recalculados: recalculados.length, detalhes: recalculados };
  });
}
