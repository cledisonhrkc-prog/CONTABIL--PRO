import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/auth-dp";

/**
 * Relatório de descontos de convênio (médico/odontológico/etc.) por
 * competência — reaproveita os itens_json já calculados nos holerites,
 * filtrando por palavra-chave no nome da rubrica (convenio, odonto,
 * saude, plano, seguro). Formato CSV, pra anexar em email pra qualquer
 * operadora — não existe layout único de "arquivo de remessa" como
 * existe pro CNAB bancário, cada operadora tem o próprio padrão, então
 * não inventamos um layout específico.
 *
 * GET /api/dp/relatorio-convenio?competencia=2026-08&palavraChave=convenio
 */
export async function GET(req: Request) {
  return withAuth(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const competencia = searchParams.get("competencia");
    const palavraChave = (searchParams.get("palavraChave") || "convenio").toLowerCase();
    if (!competencia) {
      throw new Error("Informe ?competencia=AAAA-MM na URL.");
    }

    const holerites = await db.execute(sql`
      SELECT h.itens_json, c.nome_completo, c.cpf
      FROM dp_holerites h
      JOIN colaboradores c ON c.id = h.colaborador_id
      WHERE h.empresa_id = ${ctx.empresaId} AND h.competencia = ${competencia}
    `);

    const linhas: { nome: string; cpf: string; rubrica: string; valor: number }[] = [];
    for (const h of holerites.rows as any[]) {
      let itens: any[] = [];
      try {
        itens = typeof h.itens_json === "string" ? JSON.parse(h.itens_json) : h.itens_json ?? [];
      } catch {
        continue;
      }
      for (const item of itens) {
        const nomeNorm = String(item.nome || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        if (
          nomeNorm.includes(palavraChave) ||
          nomeNorm.includes("odonto") ||
          nomeNorm.includes("saude") ||
          nomeNorm.includes("plano") ||
          nomeNorm.includes("seguro")
        ) {
          linhas.push({
            nome: h.nome_completo,
            cpf: h.cpf,
            rubrica: item.nome,
            valor: Number(item.valor),
          });
        }
      }
    }

    if (linhas.length === 0) {
      return {
        aviso: `Nenhuma rubrica de convênio encontrada na competência ${competencia} (buscando por: "${palavraChave}", "odonto", "saude", "plano", "seguro"). Verifique se os holerites dessa competência já foram processados, ou tente outra palavra-chave.`,
        linhas: [],
      };
    }

    const csvLinhas = [
      "Nome;CPF;Rubrica;Valor",
      ...linhas.map((l) => `${l.nome};${l.cpf};${l.rubrica};${l.valor.toFixed(2).replace(".", ",")}`),
    ];
    const totalGeral = Number(linhas.reduce((s, l) => s + l.valor, 0).toFixed(2));

    return { csv: csvLinhas.join("\r\n"), totalLinhas: linhas.length, totalGeral };
  });
}
