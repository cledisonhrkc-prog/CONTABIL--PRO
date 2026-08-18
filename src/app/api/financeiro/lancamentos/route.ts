import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { criarLancamentoManual } from "@/lib/financeiro";
import { db } from "@/db";
import { lancamentosFinanceiros, contasBancarias, categoriasFinanceiras } from "@/db/schema-financeiro";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  return withAuth(async (ctx) => {
    return db.select({
      id: lancamentosFinanceiros.id,
      tipo: lancamentosFinanceiros.tipo,
      data: lancamentosFinanceiros.data,
      valor: lancamentosFinanceiros.valor,
      descricao: lancamentosFinanceiros.descricao,
      participante: lancamentosFinanceiros.participante,
      status: lancamentosFinanceiros.status,
      origem: lancamentosFinanceiros.origem,
      formaPagamento: lancamentosFinanceiros.formaPagamento,
      contaNome: contasBancarias.nome,
      categoriaNome: categoriasFinanceiras.nome,
    })
    .from(lancamentosFinanceiros)
    .leftJoin(contasBancarias, eq(lancamentosFinanceiros.contaBancariaId, contasBancarias.id))
    .leftJoin(categoriasFinanceiras, eq(lancamentosFinanceiros.categoriaId, categoriasFinanceiras.id))
    .where(eq(lancamentosFinanceiros.empresaId, ctx.empresaId))
    .orderBy(desc(lancamentosFinanceiros.data), desc(lancamentosFinanceiros.id))
    .limit(200);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.tipo || !body.data || !body.valor || !body.descricao || !body.contaBancariaId) {
      throw new Error("Campos obrigatórios: tipo, data, valor, descricao, contaBancariaId");
    }
    return criarLancamentoManual({
      empresaId: ctx.empresaId,
      tipo: body.tipo,
      data: body.data,
      valor: Number(body.valor),
      descricao: body.descricao,
      contaBancariaId: Number(body.contaBancariaId),
      categoriaId: body.categoriaId ? Number(body.categoriaId) : undefined,
      centroCustoId: body.centroCustoId ? Number(body.centroCustoId) : undefined,
      participante: body.participante,
      formaPagamento: body.formaPagamento,
      observacao: body.observacao,
      usuarioId: ctx.usuarioId,
    });
  });
}
