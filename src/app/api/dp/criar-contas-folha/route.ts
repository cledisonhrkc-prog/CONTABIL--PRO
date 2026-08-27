import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { usuarioAtual } from "@/lib/empresa";

/**
 * Cria as 5 contas que faltam pra folha de pagamento funcionar no
 * plano de contas real da empresa. Códigos PROVISÓRIOS — o próprio
 * plano de contas dessa empresa nunca teve conta de folha (confirmado
 * hoje via /api/dp/buscar-plano-contas, veio vazio). Precisa validação
 * de um contador antes de virar definitivo — isso é decisão contábil
 * real, não só código.
 *
 * IMPORTANTE: usa a tabela e colunas REAIS (plano_contas: codigo,
 * descricao, tipo, natureza, nivel) — não "contas_contabeis" que não
 * existe nesse sistema.
 *
 * GET /api/dp/criar-contas-folha?empresaId=24
 */
export async function GET(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.admin) {
    return NextResponse.json({ error: "Só admin pode rodar este setup." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const empresaId = Number(searchParams.get("empresaId"));
  if (!empresaId) {
    return NextResponse.json({ error: "Informe ?empresaId=N na URL." }, { status: 400 });
  }

  // Nota: plano_contas nesse sistema não tem empresa_id na amostra que
  // vimos (parece compartilhado/global entre empresas, igual a maioria
  // dos planos de conta referenciais). Confirma isso antes: se o INSERT
  // falhar por falta de coluna empresa_id, o plano é global mesmo.
  const CONTAS_NOVAS = [
    { codigo: "6.1.05", descricao: "DESPESA COM PESSOAL", tipo: "DESPESA", natureza: "DEVEDORA" },
    { codigo: "2.1.05.01", descricao: "SALARIOS A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA" },
    { codigo: "2.1.05.02", descricao: "INSS A RECOLHER", tipo: "PASSIVO", natureza: "CREDITORA" },
    { codigo: "2.1.05.03", descricao: "FGTS A RECOLHER", tipo: "PASSIVO", natureza: "CREDITORA" },
    { codigo: "2.1.05.04", descricao: "IRRF A RECOLHER", tipo: "PASSIVO", natureza: "CREDITORA" },
  ];

  const executados: any[] = [];
  const erros: any[] = [];
  for (const conta of CONTAS_NOVAS) {
    try {
      const r = await db.execute(sql`
        INSERT INTO plano_contas (codigo, descricao, tipo, natureza, nivel)
        VALUES (${conta.codigo}, ${conta.descricao}, ${conta.tipo}, ${conta.natureza}, 4)
        ON CONFLICT (codigo) DO NOTHING
        RETURNING *
      `);
      executados.push(r.rows[0] ?? { ...conta, ja_existia: true });
    } catch (e: any) {
      erros.push({ conta, erro: e.message });
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    aviso: "Códigos PROVISÓRIOS — confirme com um contador antes de considerar definitivo.",
    executados,
    erros,
  });
}
