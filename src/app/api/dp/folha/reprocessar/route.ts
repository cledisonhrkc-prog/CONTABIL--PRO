import { withAuth } from "@/lib/auth-dp";
import { reprocessarFolhaCLT } from "@/lib/dp";

/**
 * Reprocessa holerites já gerados com a tabela de INSS/IRRF corrigida
 * (setup-calculo-v2). Só atualiza os que realmente mudaram de valor.
 */
export async function POST() {
  return withAuth(async (ctx) => reprocessarFolhaCLT(ctx.empresaId));
}
