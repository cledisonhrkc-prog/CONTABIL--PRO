import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { importarExtrato } from "@/lib/financeiro";
import { parseOFXParaLinhasExtrato } from "@/lib/converterOFX";

/**
 * Recebe o CONTEÚDO BRUTO de um arquivo .ofx (texto), converte pro
 * formato de linhas de extrato, e reaproveita a importação já existente
 * (com deduplicação por hash). Complementa a importação por CSV que já
 * existia — agora dá pra subir o arquivo original do banco direto.
 *
 * POST /api/financeiro/conciliacao/importar-ofx
 * Body: { contaBancariaId: number, conteudoOfx: string }
 */
export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.contaBancariaId || !body.conteudoOfx) {
      throw new Error("contaBancariaId e conteudoOfx são obrigatórios");
    }
    const linhas = parseOFXParaLinhasExtrato(body.conteudoOfx);
    if (linhas.length === 0) {
      throw new Error("Nenhuma transação encontrada no arquivo OFX — confirme que o arquivo está no formato correto.");
    }
    return importarExtrato({
      empresaId: ctx.empresaId,
      contaBancariaId: Number(body.contaBancariaId),
      linhas,
    });
  });
}
