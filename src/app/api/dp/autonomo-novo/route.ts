import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/** Cria colaborador (se não existir) + vínculo tipo AUTONOMO. */
export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    const { cpf, nomeCompleto, cargo, dataAdmissao } = body;
    if (!cpf || !nomeCompleto || !dataAdmissao) {
      throw new Error("Campos obrigatórios: cpf, nomeCompleto, dataAdmissao");
    }
    const cpfLimpo = String(cpf).replace(/\D/g, "");

    const colab = await db.execute(sql`
      INSERT INTO colaboradores (empresa_id, tipo_pessoa, cpf, nome_completo)
      VALUES (${ctx.empresaId}, 'FUNCIONARIO', ${cpfLimpo}, ${nomeCompleto})
      ON CONFLICT (empresa_id, cpf) DO UPDATE SET nome_completo = EXCLUDED.nome_completo
      RETURNING id
    `);
    const colaboradorId = (colab.rows[0] as any).id;

    const vinculo = await db.execute(sql`
      INSERT INTO colaborador_vinculos (empresa_id, colaborador_id, tipo_vinculo, cargo, data_admissao, salario_base)
      VALUES (${ctx.empresaId}, ${colaboradorId}, 'AUTONOMO', ${cargo || "Autônomo/RPA"}, ${dataAdmissao}, 0)
      RETURNING *
    `);

    return { colaboradorId, vinculo: vinculo.rows[0] };
  });
}
