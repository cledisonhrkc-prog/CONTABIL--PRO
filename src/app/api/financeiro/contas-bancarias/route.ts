import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { db } from "@/db";
import { contasBancarias } from "@/db/schema-financeiro";
import { listarContasBancarias, calcularSaldoConta } from "@/lib/financeiro";

export async function GET() {
  return withAuth(async (ctx) => {
    const contas = await listarContasBancarias(ctx.empresaId);
    return Promise.all(
      contas.map(async (c) => ({
        ...c,
        saldo: await calcularSaldoConta(ctx.empresaId, c.id),
      }))
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.nome) throw new Error("Nome da conta é obrigatório");
    const [conta] = await db.insert(contasBancarias).values({
      empresaId: ctx.empresaId,
      nome: body.nome,
      banco: body.banco || null,
      agencia: body.agencia || null,
      conta: body.conta || null,
      tipo: body.tipo || "CORRENTE",
      saldoInicial: String(body.saldoInicial ?? 0),
      dataSaldoInicial: body.dataSaldoInicial || null,
      cor: body.cor || "#3B82F6",
      ativa: true,
    }).returning();
    return conta;
  });
}
