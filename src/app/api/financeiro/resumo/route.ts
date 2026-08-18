import { withAuth } from "@/lib/auth-financeiro";
import { resumoContas } from "@/lib/financeiro";

export async function GET() {
  return withAuth(async (ctx) => {
    return resumoContas(ctx.empresaId);
  });
}
