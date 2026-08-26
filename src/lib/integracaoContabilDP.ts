import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface ParametrosContabilDP {
  contaDebitoDespesa: string;
  contaCreditoInssPassivo: string;
  contaCreditoFgtsPassivo: string;
  contaCreditoIrrfPassivo: string;
  contaCreditoSalariosAPagar: string;
}

export async function salvarParametrosContabilDP(empresaId: number, params: ParametrosContabilDP) {
  const r = await db.execute(sql`
    INSERT INTO contabil_parametros_dp (empresa_id, conta_debito_despesa, conta_credito_inss_passivo, conta_credito_fgts_passivo, conta_credito_irrf_passivo, conta_credito_salarios_a_pagar)
    VALUES (${empresaId}, ${params.contaDebitoDespesa}, ${params.contaCreditoInssPassivo}, ${params.contaCreditoFgtsPassivo}, ${params.contaCreditoIrrfPassivo}, ${params.contaCreditoSalariosAPagar})
    ON CONFLICT (empresa_id) DO UPDATE SET
      conta_debito_despesa = EXCLUDED.conta_debito_despesa,
      conta_credito_inss_passivo = EXCLUDED.conta_credito_inss_passivo,
      conta_credito_fgts_passivo = EXCLUDED.conta_credito_fgts_passivo,
      conta_credito_irrf_passivo = EXCLUDED.conta_credito_irrf_passivo,
      conta_credito_salarios_a_pagar = EXCLUDED.conta_credito_salarios_a_pagar,
      updated_at = NOW()
    RETURNING *
  `);
  return r.rows[0];
}

/**
 * Gera o lançamento contábil de partida dobrada pra provisão de folha.
 * Corrigido em relação ao material recebido:
 * - `exercicio` vem da própria competência, não fixo em 2026 (quebraria
 *   ano que vem)
 * - `inssPatronal` pode vir `null` (empresa Simples Nacional — nossa
 *   própria função calcularInssPatronal já retorna null nesse caso, de
 *   propósito, pra evitar cobrar em duplicidade do que já está no DAS).
 *   Trata null como zero aqui, sem quebrar.
 * - Verifica se os parâmetros de conta existem ANTES de tentar o
 *   lançamento, com mensagem clara se não existir.
 */
export async function gerarLancamentoFolha(
  empresaId: number,
  competencia: string,
  resumoFolha: {
    proventos: number;
    inss: number;
    irrf: number;
    fgts: number;
    inssPatronal: number | null;
  }
) {
  const params = await db.execute(sql`
    SELECT * FROM contabil_parametros_dp WHERE empresa_id = ${empresaId}
  `);
  if (params.rows.length === 0) {
    throw new Error(
      "Parâmetros de integração DP→Contábil não configurados para esta empresa. Cadastre as contas contábeis antes de gerar o lançamento."
    );
  }
  const p = params.rows[0] as any;

  const inssPatronal = resumoFolha.inssPatronal ?? 0;
  const anoExercicio = Number(competencia.split("-")[0]);
  const numero = `DP-${competencia}-${Date.now().toString().slice(-6)}`;
  // Líquido que ainda será pago ao colaborador — vira passivo "Salários
  // a Pagar", não desaparece do lançamento (bug do material original:
  // faltava essa conta, débito nunca fechava com crédito).
  const liquidoAPagar = Number((resumoFolha.proventos - resumoFolha.inss - resumoFolha.irrf).toFixed(2));
  // Débito total = despesa de pessoal (proventos) + encargos do
  // empregador (INSS Patronal + FGTS, que são custo da empresa, não
  // saem do bolso do colaborador).
  const debitoTotal = Number((resumoFolha.proventos + inssPatronal + resumoFolha.fgts).toFixed(2));

  const lancamento = await db.execute(sql`
    INSERT INTO lancamentos (empresa_id, competencia, numero, origem, historico, valor_total, data, exercicio, tipo_lanc)
    VALUES (${empresaId}, ${competencia}, ${numero}, 'DP', ${"Provisão Folha " + competencia}, ${debitoTotal}, CURRENT_DATE, ${anoExercicio}, 'NORMAL')
    RETURNING id
  `);
  const idLanc = (lancamento.rows[0] as any).id;

  // Débito: Despesa de Pessoal (proventos + INSS Patronal + FGTS)
  await db.execute(sql`
    INSERT INTO lancamento_itens (id_lanc, codigo_conta, debito, credito)
    VALUES (${idLanc}, ${p.conta_debito_despesa}, ${debitoTotal}, 0)
  `);

  // Crédito: INSS a Recolher (Empregado + Patronal, se houver)
  if (resumoFolha.inss + inssPatronal > 0) {
    await db.execute(sql`
      INSERT INTO lancamento_itens (id_lanc, codigo_conta, debito, credito)
      VALUES (${idLanc}, ${p.conta_credito_inss_passivo}, 0, ${resumoFolha.inss + inssPatronal})
    `);
  }

  // Crédito: IRRF a Recolher
  if (resumoFolha.irrf > 0) {
    await db.execute(sql`
      INSERT INTO lancamento_itens (id_lanc, codigo_conta, debito, credito)
      VALUES (${idLanc}, ${p.conta_credito_irrf_passivo}, 0, ${resumoFolha.irrf})
    `);
  }

  // Crédito: FGTS a Recolher/Depositar
  if (resumoFolha.fgts > 0) {
    await db.execute(sql`
      INSERT INTO lancamento_itens (id_lanc, codigo_conta, debito, credito)
      VALUES (${idLanc}, ${p.conta_credito_fgts_passivo}, 0, ${resumoFolha.fgts})
    `);
  }

  // Crédito: Salários a Pagar (o líquido, ainda não desembolsado)
  if (liquidoAPagar > 0) {
    await db.execute(sql`
      INSERT INTO lancamento_itens (id_lanc, codigo_conta, debito, credito)
      VALUES (${idLanc}, ${p.conta_credito_salarios_a_pagar}, 0, ${liquidoAPagar})
    `);
  }

  return { sucesso: true, id_lancamento: idLanc, inss_patronal_aplicado: inssPatronal > 0, debito_total: debitoTotal };
}
