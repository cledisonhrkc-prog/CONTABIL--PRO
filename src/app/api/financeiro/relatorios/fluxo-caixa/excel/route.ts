import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, AuthError } from "@/lib/auth-financeiro";
import { usuarioAtual, empresasPermitidasIds } from "@/lib/empresa";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { fluxoCaixaCompleto, calcularSaldoTotal, listarContasReceber, listarContasPagar } from "@/lib/financeiro";
import * as XLSX from "xlsx";

/**
 * Relatório de Fluxo de Caixa em Excel.
 * Mesmo padrão da rota de PDF (já corrigida hoje):
 * - ?empresaId=N  -> gera pra outra empresa (validado por permissão, sem
 *   exigir que essa empresa já esteja selecionada na sessão).
 * - ?mes=AAAA-MM  -> filtra pra um único mês; sem isso, mostra 6 meses.
 * - Inclui as contas a receber/pagar em aberto, em abas separadas.
 * Valores ficam como número de verdade na célula (não texto formatado),
 * pra o cliente poder somar/filtrar direto no Excel.
 */
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const mesFiltro = searchParams.get("mes");
    const empresaIdParam = searchParams.get("empresaId");

    let empresaId: number;
    if (empresaIdParam) {
      const solicitado = Number(empresaIdParam);
      const permitidos = await empresasPermitidasIds(usuario);
      const permitido = permitidos === null || permitidos.includes(solicitado);
      if (!permitido) {
        return NextResponse.json({ error: "Você não tem permissão para esta empresa." }, { status: 403 });
      }
      empresaId = solicitado;
    } else {
      try {
        const ctx = await getAuthContext();
        empresaId = ctx.empresaId;
      } catch (e: any) {
        if (e instanceof AuthError) {
          return NextResponse.json({ error: e.message }, { status: e.status });
        }
        throw e;
      }
    }

    const empresaResult = await db.execute(sql`SELECT nome, cnpj FROM empresas WHERE id = ${empresaId}`);
    const empresaRow = empresaResult.rows[0] as any;
    if (!empresaRow) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const nomeEmpresa = empresaRow.nome || "Empresa";
    const cnpj = empresaRow.cnpj || "";

    const fluxo = await fluxoCaixaCompleto(empresaId, 12);
    const { total: saldoAtual } = await calcularSaldoTotal(empresaId);

    const linhas = mesFiltro
      ? fluxo.filter((m: any) => `${m.ano}-${String(m.mesNumero).padStart(2, "0")}` === mesFiltro)
      : fluxo.slice(0, 6);

    if (mesFiltro && linhas.length === 0) {
      return NextResponse.json(
        { error: `Nenhum dado encontrado para a competência ${mesFiltro}. Use o formato AAAA-MM.` },
        { status: 400 }
      );
    }

    const contasReceberAbertas = await listarContasReceber(empresaId, { status: ["ABERTO", "PARCIAL"], limit: 500 });
    const contasPagarAbertas = await listarContasPagar(empresaId, { status: ["ABERTO", "PARCIAL"], limit: 500 });

    // ===== Aba 1: Fluxo de Caixa =====
    let totalEntradas = 0;
    let totalSaidas = 0;
    const linhasFluxo = (linhas as any[]).map((m) => {
      const entradas = Number(m.entradasConfirmadas) + Number(m.entradasProjetadas);
      const saidas = Number(m.saidasConfirmadas) + Number(m.saidasProjetadas);
      totalEntradas += entradas;
      totalSaidas += saidas;
      return {
        Mês: m.mes,
        Entradas: entradas,
        Saídas: saidas,
        Projetado: entradas - saidas,
        "Saldo Final": Number(m.saldoFinal),
      };
    });
    linhasFluxo.push({
      Mês: "TOTAL",
      Entradas: totalEntradas,
      Saídas: totalSaidas,
      Projetado: totalEntradas - totalSaidas,
      "Saldo Final": Number(saldoAtual),
    });

    const wsFluxo = XLSX.utils.json_to_sheet(linhasFluxo);
    wsFluxo["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

    // ===== Aba 2: Contas a Receber em aberto =====
    const linhasReceber = (contasReceberAbertas as any[]).map((c) => ({
      Participante: c.participante || "—",
      Vencimento: c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—",
      Valor: Number(c.valor) - Number(c.valorPago || 0),
      Status: c.status,
    }));
    const wsReceber = XLSX.utils.json_to_sheet(linhasReceber);
    wsReceber["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];

    // ===== Aba 3: Contas a Pagar em aberto =====
    const linhasPagar = (contasPagarAbertas as any[]).map((c) => ({
      Participante: c.participante || "—",
      Vencimento: c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—",
      Valor: Number(c.valor) - Number(c.valorPago || 0),
      Status: c.status,
    }));
    const wsPagar = XLSX.utils.json_to_sheet(linhasPagar);
    wsPagar["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsFluxo, "Fluxo de Caixa");
    XLSX.utils.book_append_sheet(wb, wsReceber, "Contas a Receber");
    XLSX.utils.book_append_sheet(wb, wsPagar, "Contas a Pagar");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=fluxo-caixa${mesFiltro ? "-" + mesFiltro : ""}.xlsx`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao gerar relatório" }, { status: 500 });
  }
}
