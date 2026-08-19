import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Prévia de cálculo de INSS/IRRF, sem gravar nada — usada pela tela de
 * novo pagamento de pró-labore pra mostrar o valor antes de confirmar.
 */
export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const valorBruto = Number(searchParams.get("valorBruto"));
    const vinculoId = searchParams.get("vinculoId");

    if (!valorBruto || valorBruto <= 0) {
      throw new Error("Informe um valorBruto válido.");
    }

    let qtdDependentes = 0;
    if (vinculoId) {
      const v = await db.execute(sql`
        SELECT colaborador_id FROM colaborador_vinculos
        WHERE id = ${Number(vinculoId)} AND empresa_id = ${ctx.empresaId} AND deleted_at IS NULL
      `);
      const colaboradorId = (v.rows[0] as any)?.colaborador_id;
      if (colaboradorId) {
        const dep = await db.execute(sql`
          SELECT COUNT(*)::int AS qtd FROM colaborador_dependentes
          WHERE colaborador_id = ${colaboradorId} AND is_dependente_irrf = true
        `);
        qtdDependentes = Number((dep.rows[0] as any)?.qtd ?? 0);
      }
    }

    const inssResult = await db.execute(sql`SELECT dp_calcular_inss(${valorBruto}::numeric, CURRENT_DATE) AS v`);
    const valorInss = Number((inssResult.rows[0] as any)?.v ?? 0);

    const baseIrrf = valorBruto - valorInss;
    const irrfResult = await db.execute(sql`
      SELECT dp_calcular_irrf(${baseIrrf}::numeric, ${qtdDependentes}::int, CURRENT_DATE, false) AS v
    `);
    const valorIrrf = Number((irrfResult.rows[0] as any)?.v ?? 0);

    const valorLiquido = Number((valorBruto - valorInss - valorIrrf).toFixed(2));

    return { valorInss, valorIrrf, valorLiquido, qtdDependentes };
  });
}
