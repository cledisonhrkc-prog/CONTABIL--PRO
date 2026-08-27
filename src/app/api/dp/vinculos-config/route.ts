import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.vinculoId) throw new Error("Campo obrigatório: vinculoId");

    const r = await db.execute(sql`
      UPDATE colaborador_vinculos
      SET
        possui_periculosidade = ${!!body.possuiPericulosidade},
        num_filhos_salario_familia = ${Number(body.numFilhosSalarioFamilia ?? 0)},
        valor_pensao_alimenticia = ${Number(body.valorPensaoAlimenticia ?? 0)},
        valor_emprestimo_consignado = ${Number(body.valorEmprestimoConsignado ?? 0)}
      WHERE id = ${body.vinculoId} AND empresa_id = ${ctx.empresaId} AND deleted_at IS NULL
      RETURNING *
    `);
    if (r.rows.length === 0) throw new Error("Vínculo não encontrado nesta empresa.");
    return r.rows[0];
  });
}

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const vinculoId = searchParams.get("vinculoId");
    if (!vinculoId) throw new Error("Informe ?vinculoId=N na URL.");

    const r = await db.execute(sql`
      SELECT cv.id, cv.possui_periculosidade, cv.num_filhos_salario_familia,
             cv.valor_pensao_alimenticia, cv.valor_emprestimo_consignado,
             c.nome_completo
      FROM colaborador_vinculos cv
      JOIN colaboradores c ON c.id = cv.colaborador_id
      WHERE cv.id = ${vinculoId} AND cv.empresa_id = ${ctx.empresaId} AND cv.deleted_at IS NULL
    `);
    if (r.rows.length === 0) throw new Error("Vínculo não encontrado nesta empresa.");
    return r.rows[0];
  });
}
