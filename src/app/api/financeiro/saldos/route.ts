import { withAuth } from "@/lib/auth-financeiro";
import { calcularSaldoTotal } from "@/lib/financeiro";

export async function GET() {
  return withAuth(async (ctx) => {
    return calcularSaldoTotal(ctx.empresaId);
  });
}
