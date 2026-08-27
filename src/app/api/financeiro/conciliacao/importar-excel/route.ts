import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { importarExtrato } from "@/lib/financeiro";
import { parseExcelExtrato } from "@/lib/parserExcelExtrato";

/**
 * Recebe um arquivo Excel de extrato bancário (em base64), converte
 * pro formato de linhas e reaproveita a importação já existente (com
 * deduplicação por hash). Aceita colunas Data/Descrição/Valor/Tipo em
 * qualquer ordem, com ou sem acento.
 *
 * POST /api/financeiro/conciliacao/importar-excel
 * Body: { contaBancariaId: number, arquivoBase64: string }
 */
export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.contaBancariaId || !body.arquivoBase64) {
      throw new Error("contaBancariaId e arquivoBase64 são obrigatórios");
    }
    const linhasExcel = parseExcelExtrato(body.arquivoBase64);
    const linhas = linhasExcel.map((l) => ({
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      tipo: l.tipo,
    }));
    return importarExtrato({
      empresaId: ctx.empresaId,
      contaBancariaId: Number(body.contaBancariaId),
      linhas,
    });
  });
}
