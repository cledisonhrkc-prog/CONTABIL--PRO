import { db } from "@/db";
import { sql } from "drizzle-orm";

const num = (v: unknown) => Number(v ?? 0);
const round = (n: number) => Math.round(n * 100) / 100;

export async function balancete(empresaId: number) {
  const r = await db.execute<{
    codigo: string;
    descricao: string;
    tipo: string;
    natureza: string;
    debito: string;
    credito: string;
    saldo: string;
  }>(sql`
    WITH m AS (
      SELECT li.codigo_conta, SUM(li.debito) d, SUM(li.credito) c
      FROM lancamento_itens li
      JOIN lancamentos l ON li.id_lanc = l.id
      WHERE l.empresa_id = ${empresaId}
      GROUP BY li.codigo_conta
    )
    SELECT p.codigo AS codigo, p.descricao, p.tipo, p.natureza,
      COALESCE(m.d,0)::text AS debito,
      COALESCE(m.c,0)::text AS credito,
      (CASE WHEN p.natureza='DEVEDORA' THEN COALESCE(m.d,0)-COALESCE(m.c,0)
            ELSE COALESCE(m.c,0)-COALESCE(m.d,0) END)::text AS saldo
    FROM plano_contas p
    LEFT JOIN m ON p.codigo = m.codigo_conta
    WHERE p.nivel = 4 AND (COALESCE(m.d,0) + COALESCE(m.c,0)) > 0
    ORDER BY p.codigo
  `);
  return r.rows.map((row) => ({
    codigo: row.codigo,
    descricao: row.descricao,
    tipo: row.tipo,
    natureza: row.natureza,
    debito: round(num(row.debito)),
    credito: round(num(row.credito)),
    saldo: round(num(row.saldo)),
  }));
}

export async function balanco(empresaId: number) {
  const r = await db.execute<{ tipo: string; saldo: string }>(sql`
    SELECT p.tipo,
      SUM(CASE WHEN p.natureza='DEVEDORA' THEN li.debito - li.credito
               ELSE li.credito - li.debito END)::text AS saldo
    FROM lancamento_itens li
    JOIN lancamentos l ON li.id_lanc = l.id
    JOIN plano_contas p ON li.codigo_conta = p.codigo
    WHERE l.empresa_id = ${empresaId} AND p.nivel = 4
    GROUP BY p.tipo
  `);
  const map: Record<string, number> = {};
  for (const row of r.rows) map[row.tipo] = round(num(row.saldo));
  return {
    ativo: map.ATIVO ?? 0,
    passivo: map.PASSIVO ?? 0,
    pl: map.PATRIMONIO_LIQUIDO ?? 0,
    receita: map.RECEITA ?? 0,
    custo: map.CUSTO ?? 0,
    despesa: map.DESPESA ?? 0,
  };
}

export type DRELinha = { descricao: string; valor: number; destaque?: boolean };

export async function dre(empresaId: number, ano: number): Promise<DRELinha[]> {
  const g = async (cods: string[]) => {
    if (cods.length === 0) return 0;
    const list = sql.join(
      cods.map((c) => sql`${c}`),
      sql.raw(",")
    );
    const r = await db.execute<{ v: string }>(sql`
      SELECT COALESCE(SUM(
        CASE WHEN p.natureza='CREDITORA' THEN li.credito - li.debito
             ELSE li.debito - li.credito END
      ),0)::text AS v
      FROM lancamento_itens li
      JOIN lancamentos l ON li.id_lanc = l.id
      JOIN plano_contas p ON li.codigo_conta = p.codigo
      WHERE l.empresa_id = ${empresaId}
        AND l.exercicio = ${ano}
        AND l.tipo_lanc = 'NORMAL'
        AND li.codigo_conta IN (${list})
    `);
    return round(num(r.rows[0]?.v ?? 0));
  };
  const rb = await g(["4.1.01", "4.1.03"]);
  const ded = await g(["4.2.01", "4.2.02", "4.2.03", "4.2.04", "4.2.05", "4.2.06", "4.2.08", "4.2.09", "4.2.10", "4.2.11"]);
  const rl = round(rb - ded);
  const cmv = await g(["5.1.01"]);
  const lb = round(rl - cmv);
  const dsp = await g(["6.2.22"]);
  const lair = round(lb - dsp);
  const ic = await g(["6.3.05", "6.3.06"]);
  const liq = round(lair - ic);
  return [
    { descricao: "Receita Bruta", valor: rb },
    { descricao: "(-) Deduções", valor: -ded },
    { descricao: "= Receita Líquida", valor: rl, destaque: true },
    { descricao: "(-) CMV", valor: -cmv },
    { descricao: "= Lucro Bruto", valor: lb, destaque: true },
    { descricao: "(-) Despesas Operacionais", valor: -dsp },
    { descricao: "= LAIR", valor: lair, destaque: true },
    { descricao: "(-) IRPJ/CSLL", valor: -ic },
    { descricao: "= Resultado Líquido", valor: liq, destaque: true },
  ];
}

export async function apuracao(empresaId: number) {
  const r = await db.execute<{
    periodo: string;
    imposto: string;
    debito: string;
    credito: string;
    apurado: string;
    a_pagar: string;
  }>(sql`
    SELECT periodo, imposto, debito::text, credito::text, apurado::text, a_pagar::text
    FROM apuracao_impostos
    WHERE empresa_id = ${empresaId}
    ORDER BY periodo, imposto
  `);
  return r.rows.map((x) => ({
    periodo: x.periodo,
    imposto: x.imposto,
    debito: round(num(x.debito)),
    credito: round(num(x.credito)),
    apurado: round(num(x.apurado)),
    a_pagar: round(num(x.a_pagar)),
  }));
}

export async function notas(empresaId: number, limit = 500) {
  const r = await db.execute<{
    id: number;
    numero: string;
    serie: string;
    tipo_operacao: string;
    finalidade: string;
    data_emissao: string;
    participante: string;
    valor_total: string;
    valor_icms: string;
    valor_pis: string;
    valor_cofins: string;
  }>(sql`
    SELECT id, numero, serie, tipo_operacao, finalidade,
           data_emissao::text, participante,
           valor_total::text, valor_icms::text, valor_pis::text, valor_cofins::text
    FROM notas_fiscais
    WHERE empresa_id = ${empresaId}
    ORDER BY data_emissao DESC
    LIMIT ${limit}
  `);
  return r.rows.map((x) => ({
    id: x.id,
    numero: x.numero,
    serie: x.serie,
    tipo_operacao: x.tipo_operacao,
    finalidade: x.finalidade,
    data_emissao: x.data_emissao,
    participante: x.participante,
    valor_total: round(num(x.valor_total)),
    valor_icms: round(num(x.valor_icms)),
    valor_pis: round(num(x.valor_pis)),
    valor_cofins: round(num(x.valor_cofins)),
  }));
}

export async function razao(empresaId: number, limit = 2000) {
  const r = await db.execute<{
    competencia: string;
    numero: string;
    origem: string;
    historico: string;
    codigo_conta: string;
    descricao: string;
    debito: string;
    credito: string;
  }>(sql`
    SELECT l.competencia::text, l.numero, l.origem, l.historico,
           li.codigo_conta, p.descricao,
           li.debito::text, li.credito::text
    FROM lancamentos l
    JOIN lancamento_itens li ON li.id_lanc = l.id
    JOIN plano_contas p ON li.codigo_conta = p.codigo
    WHERE l.empresa_id = ${empresaId}
    ORDER BY l.competencia, l.id
    LIMIT ${limit}
  `);
  return r.rows.map((x) => ({
    competencia: x.competencia,
    numero: x.numero,
    origem: x.origem,
    historico: x.historico,
    codigo_conta: x.codigo_conta,
    descricao: x.descricao,
    debito: round(num(x.debito)),
    credito: round(num(x.credito)),
  }));
}

export async function aging(empresaId: number) {
  const r = await db.execute<{ tipo: string; status: string; qtd: string; saldo: string }>(sql`
    SELECT 'RECEBER' AS tipo, status, COUNT(*)::text AS qtd, COALESCE(SUM(valor),0)::text AS saldo
    FROM contas_receber WHERE empresa_id = ${empresaId} GROUP BY status
    UNION ALL
    SELECT 'PAGAR' AS tipo, status, COUNT(*)::text AS qtd, COALESCE(SUM(valor),0)::text AS saldo
    FROM contas_pagar WHERE empresa_id = ${empresaId} GROUP BY status
  `);
  return r.rows.map((x) => ({
    tipo: x.tipo,
    status: x.status,
    qtd: Number(x.qtd),
    saldo: round(num(x.saldo)),
  }));
}

export async function auditoriaR08(empresaId: number) {
  const r = await db.execute<{
    numero_nf: string;
    regra: string;
    tipo: string;
    ncm: string;
    cst_pis: string;
    cst_cof: string;
    regime: string;
    valor_nota: string;
    valor_credito: string;
    descricao: string;
    acao: string;
  }>(sql`
    SELECT numero_nf, regra, tipo, ncm, cst_pis, cst_cof, regime,
           valor_nota::text, valor_credito::text, descricao, acao
    FROM auditoria
    WHERE empresa_id = ${empresaId}
    ORDER BY valor_credito DESC
    LIMIT 500
  `);
  return r.rows.map((x) => ({
    numero_nf: x.numero_nf,
    regra: x.regra,
    tipo: x.tipo,
    ncm: x.ncm,
    cst_pis: x.cst_pis,
    cst_cof: x.cst_cof,
    regime: x.regime,
    valor_nota: round(num(x.valor_nota)),
    valor_credito: round(num(x.valor_credito)),
    descricao: x.descricao,
    acao: x.acao,
  }));
}


export async function auditoriaClassificacaoNCM(empresaId: number) {
  const r = await db.execute<{numero:string;ncm:string;cst_pis:string;xprod:string;valor:string;qtd:string}>(sql`SELECT COALESCE(n.numero,'?') AS numero, COALESCE(i.ncm,'') AS ncm, COALESCE(i.cst_pis,'') AS cst_pis, COALESCE(MAX(i.xprod),'') AS xprod, COALESCE(SUM(i.valor_total),0)::text AS valor, COUNT(*)::text AS qtd FROM itens_nf i JOIN notas_fiscais n ON i.id_nf=n.id WHERE n.empresa_id= AND i.ncm LIKE '3004%' AND i.cst_pis IN ('49','99') GROUP BY n.numero,i.ncm,i.cst_pis ORDER BY SUM(i.valor_total) DESC LIMIT 200`);
  return r.rows.map((x)=>({numero_nf:x.numero,ncm:x.ncm,cst_pis:x.cst_pis,descricao:x.xprod,valor:round(num(x.valor)),qtd_itens:Number(x.qtd)}));
}

export async function dashboardResumo(empresaId: number) {
  const r = await db.execute<{
    qtd: string;
    receitas: string;
    despesas: string;
    saldo: string;
    receber: string;
    pagar: string;
    lucros: string;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM notas_fiscais WHERE empresa_id = ${empresaId}) AS qtd,
      -- Faturamento = SUM(vNF) PURO das notas de SAÍDA (venda/serviço).
      -- Não deduz ICMS-ST, não deduz nada. Mesmo cálculo do Colab.
      (SELECT COALESCE(SUM(valor_total),0)::text FROM notas_fiscais
        WHERE empresa_id = ${empresaId}
          AND tipo_operacao='SAIDA'
          AND finalidade IN ('VENDA','SERVICO')) AS receitas,
      (SELECT COALESCE(SUM(valor_total),0)::text FROM notas_fiscais
        WHERE empresa_id = ${empresaId} AND tipo_operacao='ENTRADA') AS despesas,
      (SELECT COALESCE(SUM(saldo),0)::text FROM bancos WHERE empresa_id = ${empresaId}) AS saldo,
      (SELECT COALESCE(SUM(valor),0)::text FROM contas_receber
        WHERE empresa_id = ${empresaId} AND status='ABERTO') AS receber,
      (SELECT COALESCE(SUM(valor),0)::text FROM contas_pagar
        WHERE empresa_id = ${empresaId} AND status='ABERTO') AS pagar,
      (SELECT COALESCE(SUM(a_pagar),0)::text FROM apuracao_impostos
        WHERE empresa_id = ${empresaId}) AS lucros
  `);
  const row = r.rows[0];
  return {
    qtd_notas: Number(row?.qtd ?? 0),
    receitas: round(num(row?.receitas)),
    despesas: round(num(row?.despesas)),
    saldo_bancario: round(num(row?.saldo)),
    contas_receber: round(num(row?.receber)),
    contas_pagar: round(num(row?.pagar)),
    impostos_apurados: round(num(row?.lucros)),
  };
}

export async function fluxoCaixaMensal(empresaId: number) {
  const r = await db.execute<{ mes: string; entradas: string; saidas: string }>(sql`
    SELECT to_char(data_emissao, 'YYYY-MM') AS mes,
      SUM(CASE WHEN tipo_operacao='SAIDA' THEN valor_total ELSE 0 END)::text AS entradas,
      SUM(CASE WHEN tipo_operacao='ENTRADA' THEN valor_total ELSE 0 END)::text AS saidas
    FROM notas_fiscais
    WHERE empresa_id = ${empresaId}
    GROUP BY 1 ORDER BY 1
  `);
  let saldo = 0;
  return r.rows.map((row) => {
    const e = round(num(row.entradas));
    const s = round(num(row.saidas));
    saldo = round(saldo + e - s);
    return { mes: row.mes, entradas: e, saidas: s, saldo };
  });
}

export async function topDespesas(empresaId: number, limit = 5) {
  const r = await db.execute<{ participante: string; total: string; qtd: string }>(sql`
    SELECT participante, COALESCE(SUM(valor_total),0)::text AS total, COUNT(*)::text AS qtd
    FROM notas_fiscais
    WHERE empresa_id = ${empresaId} AND tipo_operacao='ENTRADA'
    GROUP BY participante
    ORDER BY SUM(valor_total) DESC
    LIMIT ${limit}
  `);
  return r.rows.map((row) => ({
    participante: row.participante,
    total: round(num(row.total)),
    qtd: Number(row.qtd),
  }));
}

export async function atividadesRecentes(empresaId: number, limit = 8) {
  const r = await db.execute<{
    data: string;
    numero: string;
    historico: string;
    valor: string;
    origem: string;
  }>(sql`
    SELECT to_char(l.data, 'YYYY-MM-DD') AS data, l.numero, l.historico,
      l.valor_total::text AS valor, l.origem
    FROM lancamentos l
    WHERE l.empresa_id = ${empresaId}
    ORDER BY l.id DESC LIMIT ${limit}
  `);
  return r.rows.map((row) => ({
    data: row.data,
    numero: row.numero,
    historico: row.historico,
    valor: round(num(row.valor)),
    origem: row.origem,
  }));
}
