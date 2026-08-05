import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  empresas,
  notasFiscais,
  itensNf,
  lancamentos,
  lancamentoItens,
  auditoria,
  contasReceber,
  contasPagar,
  apuracaoImpostos,
  exercicios,
  planoContas,
  bancos,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { gerarNotasFake } from "@/lib/seed";
import { contabilizarLote } from "@/lib/contabilizador";
import { PLANO_CONTAS_PADRAO } from "@/lib/plano-contas";
import { garantirEmpresa } from "@/lib/empresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const qtd = Math.min(Number(body.qtd ?? 1000), 2000);
    const regime = String(body.regime ?? "SIMPLES");
    const anexo = String(body.anexo ?? "I");
    // Default: gera notas de 2025, 2026 e 2027 para exercitar Pré-Reforma + Transição + Reforma
    const anoInicio = Number(body.ano_inicio ?? 2025);
    const anoFim = Number(body.ano_fim ?? 2027);
    const rbt12 = body.rbt12 != null ? Number(body.rbt12) : null;
    const segmento = String(body.segmento ?? "COMERCIO");
    const reset = body.reset !== false;

    if (reset) {
      // Limpa tudo
      await db.execute(sql`TRUNCATE lancamento_itens, lancamentos, auditoria, contas_receber, contas_pagar, apuracao_impostos, exercicios, itens_nf, notas_fiscais, bancos, empresas RESTART IDENTITY CASCADE`);
      await db.execute(sql`DELETE FROM plano_contas`);
      await db.insert(planoContas).values(PLANO_CONTAS_PADRAO);
    }

    const emp = await garantirEmpresa({
      cnpj: "03000000000191",
      nome: "CONTÁBIL PRO DEMO LTDA",
      regime,
      anexo_simples: anexo,
      segmento,
    });

    // Bancos de exemplo
    await db.insert(bancos).values([
      { empresa_id: emp.id, nome: "Banco do Brasil", agencia: "1234-5", conta: "12345-6", saldo: "125680.90" },
      { empresa_id: emp.id, nome: "Itaú Unibanco", agencia: "5678-9", conta: "98765-4", saldo: "86450.00" },
      { empresa_id: emp.id, nome: "Bradesco", agencia: "2468", conta: "13579-2", saldo: "23550.00" },
      { empresa_id: emp.id, nome: "Caixa Econômica", agencia: "4321", conta: "24680-1", saldo: "9980.00" },
    ]);

    const nfs = gerarNotasFake({
      cnpjEmpresa: emp.cnpj,
      nomeEmpresa: emp.nome,
      qtd,
      anoInicio,
      anoFim,
    });

    const result = await contabilizarLote({
      empresa_id: emp.id,
      regime: regime as "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL",
      rbt12,
      anexo,
      nfs,
    });

    return NextResponse.json({
      ok: true,
      empresa: { id: emp.id, cnpj: emp.cnpj, nome: emp.nome, regime },
      result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, msg: "POST para gerar seed com 1000 notas fictícias" });
}
