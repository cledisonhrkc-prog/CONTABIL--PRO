import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  return withAuth(async (ctx) => {
    const r = await db.execute(sql`
      SELECT cv.id, cv.colaborador_id, cv.salario_base, c.nome_completo
      FROM colaborador_vinculos cv
      JOIN colaboradores c ON c.id = cv.colaborador_id
      WHERE cv.empresa_id = ${ctx.empresaId} AND cv.tipo_vinculo IN ('CLT', 'APRENDIZ')
        AND cv.is_ativo = true AND cv.deleted_at IS NULL
      ORDER BY c.nome_completo
    `);
    return r.rows;
  });
}
