import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-dp";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Cria colaborador (se não existir, pelo CPF) + vínculo tipo APRENDIZ
 * numa chamada só. FGTS 2% já é aplicado automaticamente no
 * processamento de folha (não precisa configurar nada aqui).
 */
export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    const { cpf, nomeCompleto, cargo, dataAdmissao, salarioBase } = body;
    if (!cpf || !nomeCompleto || !dataAdmissao || !salarioBase) {
      throw new Error("Campos obrigatórios: cpf, nomeCompleto, dataAdmissao, salarioBase");
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
      VALUES (${ctx.empresaId}, ${colaboradorId}, 'APRENDIZ', ${cargo || "Aprendiz"}, ${dataAdmissao}, ${salarioBase})
      RETURNING *
    `);

    return { colaboradorId, vinculo: vinculo.rows[0] };
  });
}
