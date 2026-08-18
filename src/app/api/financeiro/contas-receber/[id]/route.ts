import { withAuth } from "@/lib/auth-financeiro";
import { db } from "@/db";
import { contasReceber, contasBancarias } from "@/db/schema-financeiro";
import { eq, and } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (ctx) => {
    const { id } = await params;
    const [conta] = await db.select().from(contasReceber).where(
      and(eq(contasReceber.id, Number(id)), eq(contasReceber.empresa_id, ctx.empresaId))
    );
    if (!conta) {
      const err: any = new Error("Conta não encontrada");
      err.status = 404;
      throw err;
    }
    const bancos = await db.select({ id: contasBancarias.id, nome: contasBancarias.nome })
      .from(contasBancarias)
      .where(and(eq(contasBancarias.empresaId, ctx.empresaId), eq(contasBancarias.ativa, true)));
    return { conta, contasBancarias: bancos };
  });
}
