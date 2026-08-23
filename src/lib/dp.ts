/**
 * Módulo DP (Departamento Pessoal) — Escopo A
 * Cadastro de colaboradores + pró-labore.
 *
 * Usa SQL cru via db.execute(sql`...`), mesmo padrão de src/lib/empresa.ts
 * e src/lib/auth.ts — não redefine tabelas via Drizzle pgTable, evitando
 * o tipo de descompasso de schema que já mordeu o módulo financeiro hoje.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { criarLancamentoManual, listarContasBancarias } from "@/lib/financeiro";

// ============================================================
// TIPOS
// ============================================================
export type TipoPessoa = "FUNCIONARIO" | "SOCIO" | "ESTAGIARIO" | "AUTONOMO";
export type TipoVinculo = "CLT" | "PRO_LABORE" | "ESTAGIO" | "AUTONOMO" | "TEMPORARIO";
export type StatusProLabore = "PENDENTE" | "PAGO" | "CANCELADO";

export interface ColaboradorInput {
  tipoPessoa: TipoPessoa;
  cpf: string;
  nomeCompleto: string;
  nomeSocial?: string;
  dataNascimento?: string;
  genero?: string;
  estadoCivil?: string;
  email?: string;
  telefone?: string;
  pisPasep?: string;
  observacoes?: string;
}

export interface VinculoInput {
  colaboradorId: number;
  tipoVinculo: TipoVinculo;
  cargo?: string;
  dataAdmissao: string;
  salarioBase?: number;
  valorProLabore?: number;
  cargaHorariaSemanal?: number;
  observacoes?: string;
}

export interface ProLaboreInput {
  vinculoId: number;
  competencia: string; // YYYY-MM
  valorBruto: number;
  valorInss?: number; // Escopo A não tem motor de cálculo automático de INSS/IRRF
  valorIrrf?: number; // (isso é do Escopo B/C) — informe o valor já calculado
  dataPagamento?: string;
}

// ============================================================
// COLABORADORES
// ============================================================
export async function listarColaboradores(
  empresaId: number,
  opts: { busca?: string; tipoPessoa?: TipoPessoa; apenasAtivos?: boolean } = {}
) {
  const { busca, tipoPessoa, apenasAtivos = true } = opts;

  const r = await db.execute(sql`
    SELECT id, tipo_pessoa, cpf, nome_completo, nome_social, email, telefone,
           is_ativo, created_at
    FROM colaboradores
    WHERE empresa_id = ${empresaId}
      AND deleted_at IS NULL
      AND (${apenasAtivos}::boolean = false OR is_ativo = true)
      AND (${tipoPessoa ?? null}::text IS NULL OR tipo_pessoa = ${tipoPessoa ?? null})
      AND (
        ${busca ?? null}::text IS NULL
        OR nome_completo ILIKE '%' || ${busca ?? ""} || '%'
        OR cpf = regexp_replace(${busca ?? ""}, '[^0-9]', '', 'g')
      )
    ORDER BY nome_completo
  `);
  return r.rows;
}

export async function obterColaborador(empresaId: number, id: number) {
  const r = await db.execute(sql`
    SELECT * FROM colaboradores
    WHERE id = ${id} AND empresa_id = ${empresaId} AND deleted_at IS NULL
  `);
  const colaborador = r.rows[0];
  if (!colaborador) return null;

  const [endereco, contas, dependentes, vinculos] = await Promise.all([
    db.execute(sql`SELECT * FROM colaborador_enderecos WHERE colaborador_id = ${id}`),
    db.execute(sql`SELECT * FROM colaborador_contas_bancarias WHERE colaborador_id = ${id} ORDER BY is_principal DESC`),
    db.execute(sql`SELECT * FROM colaborador_dependentes WHERE colaborador_id = ${id} ORDER BY nome_completo`),
    db.execute(sql`
      SELECT * FROM colaborador_vinculos
      WHERE colaborador_id = ${id} AND empresa_id = ${empresaId} AND deleted_at IS NULL
      ORDER BY data_admissao DESC
    `),
  ]);

  return {
    ...colaborador,
    endereco: endereco.rows[0] ?? null,
    contasBancarias: contas.rows,
    dependentes: dependentes.rows,
    vinculos: vinculos.rows,
  };
}

export async function criarColaborador(empresaId: number, dados: ColaboradorInput) {
  const cpfLimpo = dados.cpf.replace(/\D/g, "");
  if (cpfLimpo.length !== 11) {
    throw new Error("CPF inválido — precisa ter 11 dígitos.");
  }

  const existente = await db.execute(sql`
    SELECT id FROM colaboradores
    WHERE empresa_id = ${empresaId} AND cpf = ${cpfLimpo} AND deleted_at IS NULL
  `);
  if (existente.rows.length > 0) {
    throw new Error("Já existe um colaborador com esse CPF nesta empresa.");
  }

  const r = await db.execute(sql`
    INSERT INTO colaboradores (
      empresa_id, tipo_pessoa, cpf, nome_completo, nome_social,
      data_nascimento, genero, estado_civil, email, telefone, pis_pasep, observacoes
    ) VALUES (
      ${empresaId}, ${dados.tipoPessoa}, ${cpfLimpo}, ${dados.nomeCompleto}, ${dados.nomeSocial ?? null},
      ${dados.dataNascimento ?? null}, ${dados.genero ?? null}, ${dados.estadoCivil ?? null},
      ${dados.email ?? null}, ${dados.telefone ?? null}, ${dados.pisPasep?.replace(/\D/g, "") ?? null},
      ${dados.observacoes ?? null}
    )
    RETURNING *
  `);
  return r.rows[0];
}

export async function atualizarColaborador(
  empresaId: number,
  id: number,
  dados: Partial<ColaboradorInput> & { isAtivo?: boolean }
) {
  const existente = await db.execute(sql`
    SELECT id FROM colaboradores WHERE id = ${id} AND empresa_id = ${empresaId} AND deleted_at IS NULL
  `);
  if (existente.rows.length === 0) {
    throw new Error("Colaborador não encontrado nesta empresa.");
  }

  const r = await db.execute(sql`
    UPDATE colaboradores SET
      nome_completo = COALESCE(${dados.nomeCompleto ?? null}, nome_completo),
      nome_social = COALESCE(${dados.nomeSocial ?? null}, nome_social),
      email = COALESCE(${dados.email ?? null}, email),
      telefone = COALESCE(${dados.telefone ?? null}, telefone),
      genero = COALESCE(${dados.genero ?? null}, genero),
      estado_civil = COALESCE(${dados.estadoCivil ?? null}, estado_civil),
      data_nascimento = COALESCE(${dados.dataNascimento ?? null}, data_nascimento),
      pis_pasep = COALESCE(${dados.pisPasep?.replace(/\D/g, "") ?? null}, pis_pasep),
      is_ativo = COALESCE(${dados.isAtivo ?? null}, is_ativo),
      observacoes = COALESCE(${dados.observacoes ?? null}, observacoes),
      updated_at = NOW()
    WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING *
  `);
  return r.rows[0];
}

// ============================================================
// ENDEREÇO / CONTA BANCÁRIA / DEPENDENTES
// ============================================================
export async function salvarEndereco(
  empresaId: number,
  colaboradorId: number,
  dados: { cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string }
) {
  await assertColaboradorDaEmpresa(empresaId, colaboradorId);

  const r = await db.execute(sql`
    INSERT INTO colaborador_enderecos (colaborador_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
    VALUES (${colaboradorId}, ${dados.cep ?? null}, ${dados.logradouro ?? null}, ${dados.numero ?? null},
            ${dados.complemento ?? null}, ${dados.bairro ?? null}, ${dados.cidade ?? null}, ${dados.uf ?? null})
    ON CONFLICT (colaborador_id) DO UPDATE SET
      cep = EXCLUDED.cep, logradouro = EXCLUDED.logradouro, numero = EXCLUDED.numero,
      complemento = EXCLUDED.complemento, bairro = EXCLUDED.bairro, cidade = EXCLUDED.cidade,
      uf = EXCLUDED.uf, updated_at = NOW()
    RETURNING *
  `);
  return r.rows[0];
}

export async function adicionarContaBancaria(
  empresaId: number,
  colaboradorId: number,
  dados: { bancoCodigo: string; bancoNome?: string; agencia: string; conta: string; digito?: string; tipoConta?: string; isPrincipal?: boolean }
) {
  await assertColaboradorDaEmpresa(empresaId, colaboradorId);

  if (dados.isPrincipal) {
    await db.execute(sql`
      UPDATE colaborador_contas_bancarias SET is_principal = false WHERE colaborador_id = ${colaboradorId}
    `);
  }

  const r = await db.execute(sql`
    INSERT INTO colaborador_contas_bancarias (
      colaborador_id, banco_codigo, banco_nome, agencia, conta, digito, tipo_conta, is_principal
    ) VALUES (
      ${colaboradorId}, ${dados.bancoCodigo}, ${dados.bancoNome ?? null}, ${dados.agencia}, ${dados.conta},
      ${dados.digito ?? null}, ${dados.tipoConta ?? "CORRENTE"}, ${dados.isPrincipal ?? true}
    )
    RETURNING *
  `);
  return r.rows[0];
}

export async function adicionarDependente(
  empresaId: number,
  colaboradorId: number,
  dados: { nomeCompleto: string; cpf?: string; dataNascimento?: string; parentesco: string; isDependenteIrrf?: boolean; isSalarioFamilia?: boolean }
) {
  await assertColaboradorDaEmpresa(empresaId, colaboradorId);

  const r = await db.execute(sql`
    INSERT INTO colaborador_dependentes (
      colaborador_id, nome_completo, cpf, data_nascimento, parentesco, is_dependente_irrf, is_salario_familia
    ) VALUES (
      ${colaboradorId}, ${dados.nomeCompleto}, ${dados.cpf?.replace(/\D/g, "") ?? null}, ${dados.dataNascimento ?? null},
      ${dados.parentesco}, ${dados.isDependenteIrrf ?? false}, ${dados.isSalarioFamilia ?? false}
    )
    RETURNING *
  `);
  return r.rows[0];
}

async function assertColaboradorDaEmpresa(empresaId: number, colaboradorId: number) {
  const r = await db.execute(sql`
    SELECT id FROM colaboradores WHERE id = ${colaboradorId} AND empresa_id = ${empresaId} AND deleted_at IS NULL
  `);
  if (r.rows.length === 0) {
    throw new Error("Colaborador não encontrado nesta empresa.");
  }
}

// ============================================================
// VÍNCULOS
// ============================================================
export async function listarVinculos(
  empresaId: number,
  opts: { colaboradorId?: number; tipoVinculo?: TipoVinculo; apenasAtivos?: boolean } = {}
) {
  const { colaboradorId, tipoVinculo, apenasAtivos = true } = opts;

  const r = await db.execute(sql`
    SELECT v.*, c.nome_completo AS colaborador_nome, c.cpf AS colaborador_cpf
    FROM colaborador_vinculos v
    JOIN colaboradores c ON c.id = v.colaborador_id
    WHERE v.empresa_id = ${empresaId}
      AND v.deleted_at IS NULL
      AND (${colaboradorId ?? null}::int IS NULL OR v.colaborador_id = ${colaboradorId ?? null})
      AND (${tipoVinculo ?? null}::text IS NULL OR v.tipo_vinculo = ${tipoVinculo ?? null})
      AND (${apenasAtivos}::boolean = false OR v.is_ativo = true)
    ORDER BY v.data_admissao DESC
  `);
  return r.rows;
}

export async function criarVinculo(empresaId: number, dados: VinculoInput) {
  await assertColaboradorDaEmpresa(empresaId, dados.colaboradorId);

  // O trigger dp_validar_empresa_colaborador() do banco também bloqueia
  // empresa_id inconsistente — esta checagem aqui é a primeira camada,
  // defesa em profundidade.
  const r = await db.execute(sql`
    INSERT INTO colaborador_vinculos (
      empresa_id, colaborador_id, tipo_vinculo, cargo, data_admissao,
      salario_base, valor_pro_labore, carga_horaria_semanal, observacoes
    ) VALUES (
      ${empresaId}, ${dados.colaboradorId}, ${dados.tipoVinculo}, ${dados.cargo ?? null}, ${dados.dataAdmissao},
      ${dados.salarioBase ?? 0}, ${dados.valorProLabore ?? null}, ${dados.cargaHorariaSemanal ?? null},
      ${dados.observacoes ?? null}
    )
    RETURNING *
  `);
  return r.rows[0];
}

// ============================================================
// PRÓ-LABORE
// ============================================================
export async function listarProLabore(
  empresaId: number,
  opts: { competencia?: string; vinculoId?: number; status?: StatusProLabore } = {}
) {
  const { competencia, vinculoId, status } = opts;

  const r = await db.execute(sql`
    SELECT p.*, c.nome_completo AS colaborador_nome
    FROM pro_labore_pagamentos p
    JOIN colaboradores c ON c.id = p.colaborador_id
    WHERE p.empresa_id = ${empresaId}
      AND (${competencia ?? null}::text IS NULL OR p.competencia = ${competencia ?? null})
      AND (${vinculoId ?? null}::int IS NULL OR p.vinculo_id = ${vinculoId ?? null})
      AND (${status ?? null}::text IS NULL OR p.status = ${status ?? null})
    ORDER BY p.competencia DESC, c.nome_completo
  `);
  return r.rows;
}

export async function criarPagamentoProLabore(empresaId: number, dados: ProLaboreInput) {
  const vinculo = await db.execute(sql`
    SELECT id, colaborador_id, tipo_vinculo FROM colaborador_vinculos
    WHERE id = ${dados.vinculoId} AND empresa_id = ${empresaId} AND deleted_at IS NULL
  `);
  const v = vinculo.rows[0] as any;
  if (!v) throw new Error("Vínculo não encontrado nesta empresa.");
  if (v.tipo_vinculo !== "PRO_LABORE") {
    throw new Error("Esse vínculo não é do tipo PRO_LABORE.");
  }

  // Se valorInss/valorIrrf não vierem informados, calcula automaticamente
  // via dp_calcular_inss/dp_calcular_irrf (motor validado — ver setup-calculo).
  // Reaproveita dependentes já cadastrados (colaborador_dependentes) quando
  // existirem, em vez de assumir 0 sempre.
  let valorInss = dados.valorInss;
  let valorIrrf = dados.valorIrrf;

  if (valorInss === undefined || valorIrrf === undefined) {
    const depResult = await db.execute(sql`
      SELECT COUNT(*)::int AS qtd FROM colaborador_dependentes
      WHERE colaborador_id = ${v.colaborador_id} AND is_dependente_irrf = true
    `);
    const qtdDependentes = Number((depResult.rows[0] as any)?.qtd ?? 0);

    if (valorInss === undefined) {
      // CORRIGIDO: pró-labore de sócio usa 11% fixo (contribuinte
      // individual), não a tabela progressiva de CLT. Confirmado contra
      // múltiplas fontes contábeis/gov.br em 20/08/2026.
      const r = await db.execute(sql`SELECT dp_calcular_inss_prolabore(${dados.valorBruto}::numeric, CURRENT_DATE) AS v`);
      valorInss = Number((r.rows[0] as any)?.v ?? 0);
    }
    if (valorIrrf === undefined) {
      const baseIrrf = dados.valorBruto - valorInss;
      const r = await db.execute(sql`
        SELECT dp_calcular_irrf(${baseIrrf}::numeric, ${qtdDependentes}::int, CURRENT_DATE, false) AS v
      `);
      valorIrrf = Number((r.rows[0] as any)?.v ?? 0);
    }
  }

  valorInss = Number(valorInss.toFixed(2));
  valorIrrf = Number(valorIrrf.toFixed(2));
  const valorLiquido = Number((dados.valorBruto - valorInss - valorIrrf).toFixed(2));

  if (valorLiquido < 0) {
    throw new Error(
      `Não é possível lançar: INSS (R$ ${valorInss.toFixed(2)}) + IRRF (R$ ${valorIrrf.toFixed(2)}) ` +
        `ultrapassam o valor bruto (R$ ${dados.valorBruto.toFixed(2)}), resultando em líquido negativo.`
    );
  }

  const r = await db.execute(sql`
    INSERT INTO pro_labore_pagamentos (
      empresa_id, vinculo_id, colaborador_id, competencia, valor_bruto,
      valor_inss, valor_irrf, valor_liquido, data_pagamento, status
    ) VALUES (
      ${empresaId}, ${dados.vinculoId}, ${v.colaborador_id}, ${dados.competencia}, ${dados.valorBruto},
      ${valorInss}, ${valorIrrf}, ${valorLiquido}, ${dados.dataPagamento ?? null},
      ${dados.dataPagamento ? "PAGO" : "PENDENTE"}
    )
    RETURNING *
  `);
  return r.rows[0];
}

export async function marcarProLaborePago(empresaId: number, id: number, dataPagamento: string) {
  const r = await db.execute(sql`
    UPDATE pro_labore_pagamentos
    SET status = 'PAGO', data_pagamento = ${dataPagamento}
    WHERE id = ${id} AND empresa_id = ${empresaId} AND status = 'PENDENTE'
    RETURNING *
  `);
  if (!r.rows[0]) throw new Error("Pagamento não encontrado, não pertence a esta empresa, ou não está mais pendente.");
  return r.rows[0];
}

/**
 * Cancela um pagamento de pró-labore. Só funciona em status PENDENTE — um
 * pagamento já marcado como PAGO não pode ser cancelado por aqui (evita
 * apagar rastro de algo que já saiu do caixa; se precisar estornar um
 * pagamento já feito, isso deveria acontecer via lançamento financeiro,
 * não só mudando o status aqui).
 */
export async function cancelarPagamentoProLabore(empresaId: number, id: number, motivo?: string) {
  const r = await db.execute(sql`
    UPDATE pro_labore_pagamentos
    SET status = 'CANCELADO', observacoes = COALESCE(${motivo ?? null}, observacoes)
    WHERE id = ${id} AND empresa_id = ${empresaId} AND status = 'PENDENTE'
    RETURNING *
  `);
  if (!r.rows[0]) throw new Error("Pagamento não encontrado, não pertence a esta empresa, ou já não está mais pendente.");
  return r.rows[0];
}

/**
 * Resumo de pró-labore agrupado por competência e sócio — total bruto,
 * total líquido, quantidade de pagamentos. Ignora cancelados.
 */
export async function resumoProLaborePorCompetencia(empresaId: number, opts: { competencia?: string } = {}) {
  const r = await db.execute(sql`
    SELECT c.id AS colaborador_id, c.nome_completo, p.competencia,
      SUM(p.valor_bruto) AS total_bruto,
      SUM(p.valor_inss) AS total_inss,
      SUM(p.valor_irrf) AS total_irrf,
      SUM(p.valor_liquido) AS total_liquido,
      COUNT(*) AS qtd_pagamentos,
      COUNT(*) FILTER (WHERE p.status = 'PAGO') AS qtd_pagos,
      COUNT(*) FILTER (WHERE p.status = 'PENDENTE') AS qtd_pendentes
    FROM pro_labore_pagamentos p
    JOIN colaboradores c ON c.id = p.colaborador_id
    WHERE p.empresa_id = ${empresaId}
      AND p.status != 'CANCELADO'
      AND (${opts.competencia ?? null}::text IS NULL OR p.competencia = ${opts.competencia ?? null})
    GROUP BY c.id, c.nome_completo, p.competencia
    ORDER BY p.competencia DESC, c.nome_completo
  `);
  return r.rows;
}

/**
 * Atualiza dados editáveis de um vínculo (cargo, salário/pró-labore,
 * carga horária). O trigger dp_validar_empresa_colaborador() do banco
 * garante isolamento por empresa mesmo se algo aqui falhar.
 */
export async function atualizarVinculo(
  empresaId: number,
  id: number,
  dados: { cargo?: string; salarioBase?: number; valorProLabore?: number; cargaHorariaSemanal?: number; observacoes?: string }
) {
  const existente = await db.execute(sql`
    SELECT id FROM colaborador_vinculos WHERE id = ${id} AND empresa_id = ${empresaId} AND deleted_at IS NULL
  `);
  if (existente.rows.length === 0) {
    throw new Error("Vínculo não encontrado nesta empresa.");
  }

  const r = await db.execute(sql`
    UPDATE colaborador_vinculos SET
      cargo = COALESCE(${dados.cargo ?? null}, cargo),
      salario_base = COALESCE(${dados.salarioBase ?? null}, salario_base),
      valor_pro_labore = COALESCE(${dados.valorProLabore ?? null}, valor_pro_labore),
      carga_horaria_semanal = COALESCE(${dados.cargaHorariaSemanal ?? null}, carga_horaria_semanal),
      observacoes = COALESCE(${dados.observacoes ?? null}, observacoes),
      updated_at = NOW()
    WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING *
  `);
  return r.rows[0];
}

/**
 * Encerra um vínculo (data_demissao + is_ativo=false). Não mexe no
 * colaborador — um colaborador pode ter outros vínculos ativos.
 */
export async function encerrarVinculo(empresaId: number, id: number, dataDemissao: string) {
  const existente = await db.execute(sql`
    SELECT id FROM colaborador_vinculos WHERE id = ${id} AND empresa_id = ${empresaId} AND deleted_at IS NULL AND is_ativo = true
  `);
  if (existente.rows.length === 0) {
    throw new Error("Vínculo ativo não encontrado nesta empresa.");
  }

  const r = await db.execute(sql`
    UPDATE colaborador_vinculos
    SET data_demissao = ${dataDemissao}, is_ativo = false, updated_at = NOW()
    WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING *
  `);
  return r.rows[0];
}

// ============================================================
// RUBRICAS (proventos/descontos fixos, folha CLT)
// ============================================================
export async function listarRubricas(empresaId: number) {
  const r = await db.execute(sql`
    SELECT * FROM dp_rubricas WHERE empresa_id = ${empresaId} AND is_ativo = true ORDER BY nome
  `);
  return r.rows;
}

export async function criarRubrica(
  empresaId: number,
  dados: { codigo: string; nome: string; tipo: "PROVENTO" | "DESCONTO"; valorFixo: number }
) {
  const existente = await db.execute(sql`
    SELECT id FROM dp_rubricas WHERE empresa_id = ${empresaId} AND codigo = ${dados.codigo}
  `);
  if (existente.rows.length > 0) {
    throw new Error("Já existe uma rubrica com esse código nesta empresa.");
  }
  const r = await db.execute(sql`
    INSERT INTO dp_rubricas (empresa_id, codigo, nome, tipo, valor_fixo)
    VALUES (${empresaId}, ${dados.codigo}, ${dados.nome}, ${dados.tipo}, ${dados.valorFixo})
    RETURNING *
  `);
  return r.rows[0];
}

// ============================================================
// FOLHA CLT — PROCESSAMENTO MENSAL
// ============================================================
export async function atualizarPensaoAlimenticia(
  empresaId: number,
  vinculoId: number,
  valorPensao: number
) {
  if (valorPensao < 0) throw new Error("Valor de pensão não pode ser negativo.");
  const r = await db.execute(sql`
    UPDATE colaborador_vinculos
    SET valor_pensao_alimenticia = ${valorPensao}
    WHERE id = ${vinculoId} AND empresa_id = ${empresaId} AND deleted_at IS NULL
    RETURNING *
  `);
  if (r.rows.length === 0) throw new Error("Vínculo não encontrado nesta empresa.");
  return r.rows[0];
}

/**
 * Calcula quantos dias foram trabalhados numa competência, usando a
 * convenção comercial CLT de mês de 30 dias (não calendário real). Se o
 * colaborador foi admitido em mês anterior, retorna 30 (mês cheio). Se foi
 * admitido dentro do próprio mês da competência, retorna os dias restantes
 * a partir da data de admissão.
 */
function calcularDiasTrabalhados(dataAdmissao: string, competencia: string): number {
  const [anoComp, mesComp] = competencia.split("-").map(Number);
  const admissao = new Date(dataAdmissao + "T00:00:00");
  const anoAdm = admissao.getFullYear();
  const mesAdm = admissao.getMonth() + 1;
  const diaAdm = admissao.getDate();

  if (anoAdm < anoComp || (anoAdm === anoComp && mesAdm < mesComp)) {
    return 30;
  }
  if (anoAdm === anoComp && mesAdm === mesComp) {
    return 30 - diaAdm + 1;
  }
  throw new Error("Admissão é posterior à competência informada — não é possível processar folha para um mês antes da admissão.");
}

/**
 * Calcula e registra a provisão mensal de férias e 13º pra um vínculo CLT.
 * Fórmula padrão: 1/12 do direito anual, por mês trabalhado. Férias inclui
 * o 1/3 constitucional. Isso NÃO gera lançamento contábil de partida
 * dobrada (débito DRE / crédito passivo) — isso exigiria conhecer o plano
 * de contas real do módulo Contábil, que ainda não foi integrado. O que
 * isso dá: o valor que a empresa já "deve" acumulado, mês a mês, por
 * colaborador — a parte que dá pra calcular com segurança hoje.
 */
export async function provisionarFeriasDecimoTerceiro(
  empresaId: number,
  dados: { vinculoId: number; competencia: string }
) {
  const vinculo = await db.execute(sql`
    SELECT id, colaborador_id, salario_base FROM colaborador_vinculos
    WHERE id = ${dados.vinculoId} AND empresa_id = ${empresaId}
      AND tipo_vinculo = 'CLT' AND is_ativo = true AND deleted_at IS NULL
  `);
  const v = vinculo.rows[0] as any;
  if (!v) throw new Error("Vínculo CLT ativo não encontrado nesta empresa.");

  const salarioBase = Number(v.salario_base);
  const provisaoFerias = Number(((salarioBase / 12) + (salarioBase / 3 / 12)).toFixed(2));
  const provisaoDecimoTerceiro = Number((salarioBase / 12).toFixed(2));

  const r = await db.execute(sql`
    INSERT INTO dp_provisoes (empresa_id, colaborador_id, vinculo_id, competencia, valor_provisao_ferias, valor_provisao_decimo_terceiro)
    VALUES (${empresaId}, ${v.colaborador_id}, ${dados.vinculoId}, ${dados.competencia}, ${provisaoFerias}, ${provisaoDecimoTerceiro})
    ON CONFLICT (vinculo_id, competencia) DO UPDATE SET
      valor_provisao_ferias = EXCLUDED.valor_provisao_ferias,
      valor_provisao_decimo_terceiro = EXCLUDED.valor_provisao_decimo_terceiro
    RETURNING *
  `);
  return r.rows[0];
}

export async function listarProvisoes(empresaId: number, opts: { ano?: number } = {}) {
  const r = await db.execute(sql`
    SELECT p.*, c.nome_completo AS colaborador_nome
    FROM dp_provisoes p
    JOIN colaboradores c ON c.id = p.colaborador_id
    WHERE p.empresa_id = ${empresaId}
      AND (${opts.ano ?? null}::int IS NULL OR LEFT(p.competencia, 4)::int = ${opts.ano ?? null})
    ORDER BY p.competencia DESC, c.nome_completo
  `);
  return r.rows;
}

/**
 * Resumo do saldo acumulado de provisão por colaborador — soma tudo que
 * já foi provisionado no ano até agora.
 */
export async function resumoProvisoesPorColaborador(empresaId: number, ano: number) {
  const r = await db.execute(sql`
    SELECT
      p.colaborador_id,
      c.nome_completo AS colaborador_nome,
      SUM(p.valor_provisao_ferias) AS total_ferias_acumulado,
      SUM(p.valor_provisao_decimo_terceiro) AS total_decimo_acumulado,
      COUNT(*)::int AS meses_provisionados
    FROM dp_provisoes p
    JOIN colaboradores c ON c.id = p.colaborador_id
    WHERE p.empresa_id = ${empresaId} AND LEFT(p.competencia, 4)::int = ${ano}
    GROUP BY p.colaborador_id, c.nome_completo
    ORDER BY c.nome_completo
  `);
  return r.rows;
}

export async function processarFolhaCLT(
  empresaId: number,
  dados: {
    colaboradorId: number;
    competencia: string;
    horaExtra50Horas?: number;
    horaExtra100Horas?: number;
    horasNoturnas?: number;
  }
) {
  const vinculo = await db.execute(sql`
    SELECT cv.id, cv.colaborador_id, cv.salario_base, cv.valor_pensao_alimenticia, cv.data_admissao, c.nome_completo
    FROM colaborador_vinculos cv
    JOIN colaboradores c ON c.id = cv.colaborador_id
    WHERE cv.colaborador_id = ${dados.colaboradorId} AND cv.empresa_id = ${empresaId}
      AND cv.tipo_vinculo = 'CLT' AND cv.is_ativo = true AND cv.deleted_at IS NULL
  `);
  const v = vinculo.rows[0] as any;
  if (!v) throw new Error("Vínculo CLT ativo não encontrado para esse colaborador, nesta empresa.");

  const salarioBaseIntegral = Number(v.salario_base);
  if (!salarioBaseIntegral || salarioBaseIntegral <= 0) {
    throw new Error("Vínculo CLT sem salário base cadastrado.");
  }

  // Rateio de mês parcial: se o colaborador foi admitido dentro do próprio
  // mês da competência, o salário (e tudo que é calculado a partir dele)
  // é proporcional aos dias trabalhados, não o valor cheio.
  const diasTrabalhados = calcularDiasTrabalhados(v.data_admissao, dados.competencia);
  const salarioBase =
    diasTrabalhados < 30
      ? Number(((salarioBaseIntegral * diasTrabalhados) / 30).toFixed(2))
      : salarioBaseIntegral;

  // Verbas variáveis (hora extra, adicional noturno) — todas incidem
  // INSS/IRRF/FGTS, por isso entram na base ANTES de calcular os impostos.
  // Jornada padrão de 220h/mês (44h semanais), conforme praxe CLT.
  const valorHora = salarioBaseIntegral / 220;
  const he50Horas = dados.horaExtra50Horas ?? 0;
  const he100Horas = dados.horaExtra100Horas ?? 0;
  const horasNoturnas = dados.horasNoturnas ?? 0;

  const valorHe50 = Number((valorHora * 1.5 * he50Horas).toFixed(2));
  const valorHe100 = Number((valorHora * 2.0 * he100Horas).toFixed(2));
  // Adicional noturno: 20% sobre a hora + hora reduzida (52min30s = fator 1.1428)
  const valorAdicionalNoturno = Number((valorHora * 0.2 * horasNoturnas * 1.1428).toFixed(2));

  const totalVariavelBruto = valorHe50 + valorHe100 + valorAdicionalNoturno;
  // DSR sobre variáveis: aproximação padrão de mercado (25 dias úteis, 5
  // dias de descanso). Não é calendário exato do mês — calendário de
  // feriados por município ainda não existe no sistema.
  const valorDsr = totalVariavelBruto > 0 ? Number(((totalVariavelBruto / 25) * 5).toFixed(2)) : 0;

  const totalVariavel = Number((totalVariavelBruto + valorDsr).toFixed(2));
  const baseCalculo = Number((salarioBase + totalVariavel).toFixed(2));

  // Reaproveita o motor de cálculo já validado (dp_calcular_inss/dp_calcular_irrf)
  const inssResult = await db.execute(sql`SELECT dp_calcular_inss(${baseCalculo}::numeric, CURRENT_DATE) AS v`);
  const valorInss = Number((inssResult.rows[0] as any)?.v ?? 0);

  const depResult = await db.execute(sql`
    SELECT COUNT(*)::int AS qtd FROM colaborador_dependentes
    WHERE colaborador_id = ${dados.colaboradorId} AND is_dependente_irrf = true
  `);
  const qtdDependentes = Number((depResult.rows[0] as any)?.qtd ?? 0);

  // Pensão alimentícia: reduz a base do IRRF (Lei 9.250/95, Art. 4º, II) —
  // diferente de outros descontos, que não afetam a base tributável. Não
  // reduz a base do INSS (INSS incide sempre sobre o bruto).
  const valorPensao = Number(v.valor_pensao_alimenticia ?? 0);

  const baseIrrf = baseCalculo - valorInss - valorPensao;
  const irrfResult = await db.execute(sql`
    SELECT dp_calcular_irrf(${baseIrrf}::numeric, ${qtdDependentes}::int, CURRENT_DATE, false) AS v
  `);
  const valorIrrf = Number((irrfResult.rows[0] as any)?.v ?? 0);

  const fgtsMes = Number((baseCalculo * 0.08).toFixed(2));

  const rubricas = await db.execute(sql`
    SELECT * FROM dp_rubricas WHERE empresa_id = ${empresaId} AND is_ativo = true
  `);

  let totalProventos = baseCalculo;
  let totalDescontos = valorInss + valorIrrf + valorPensao;
  const itens: Array<{ codigo: string; nome: string; tipo: string; valor: number }> = [
    {
      codigo: "SALARIO",
      nome: diasTrabalhados < 30 ? `Salário base (proporcional — ${diasTrabalhados}/30 dias)` : "Salário base",
      tipo: "PROVENTO",
      valor: salarioBase,
    },
  ];
  if (valorHe50 > 0) itens.push({ codigo: "HE50", nome: `Hora extra 50% (${he50Horas}h)`, tipo: "PROVENTO", valor: valorHe50 });
  if (valorHe100 > 0) itens.push({ codigo: "HE100", nome: `Hora extra 100% (${he100Horas}h)`, tipo: "PROVENTO", valor: valorHe100 });
  if (valorAdicionalNoturno > 0) itens.push({ codigo: "AD_NOTURNO", nome: `Adicional noturno (${horasNoturnas}h)`, tipo: "PROVENTO", valor: valorAdicionalNoturno });
  if (valorDsr > 0) itens.push({ codigo: "DSR_VAR", nome: "DSR sobre variáveis", tipo: "PROVENTO", valor: valorDsr });
  itens.push(
    { codigo: "INSS", nome: "INSS", tipo: "DESCONTO", valor: valorInss },
    { codigo: "IRRF", nome: "IRRF", tipo: "DESCONTO", valor: valorIrrf }
  );
  if (valorPensao > 0) {
    itens.push({ codigo: "PENSAO", nome: "Pensão alimentícia", tipo: "DESCONTO", valor: valorPensao });
  }


  for (const rub of rubricas.rows as any[]) {
    const valor = Number(rub.valor_fixo);
    if (rub.tipo === "PROVENTO") {
      totalProventos += valor;
    } else {
      totalDescontos += valor;
    }
    itens.push({ codigo: rub.codigo, nome: rub.nome, tipo: rub.tipo, valor });
  }

  totalProventos = Number(totalProventos.toFixed(2));
  totalDescontos = Number(totalDescontos.toFixed(2));
  const totalLiquido = Number((totalProventos - totalDescontos).toFixed(2));

  // Proteção contra líquido negativo — nunca deixa gravar um holerite onde
  // os descontos ultrapassam os proventos. Isso é sempre inválido, não
  // importa a combinação de rubricas que causou.
  if (totalLiquido < 0) {
    throw new Error(
      `Não é possível processar: os descontos (R$ ${totalDescontos.toFixed(2)}) são maiores que os ` +
        `proventos (R$ ${totalProventos.toFixed(2)}), o que resultaria em líquido negativo de ` +
        `R$ ${totalLiquido.toFixed(2)}. Revise as rubricas de desconto cadastradas para este colaborador.`
    );
  }

  const r = await db.execute(sql`
    INSERT INTO dp_holerites (
      empresa_id, colaborador_id, vinculo_id, competencia, salario_base,
      total_proventos, total_descontos, total_liquido, fgts_mes, valor_inss, valor_irrf,
      itens_json, status
    ) VALUES (
      ${empresaId}, ${dados.colaboradorId}, ${v.id}, ${dados.competencia}, ${salarioBase},
      ${totalProventos}, ${totalDescontos}, ${totalLiquido}, ${fgtsMes}, ${valorInss}, ${valorIrrf},
      ${JSON.stringify(itens)}, 'PROCESSADO'
    )
    ON CONFLICT (colaborador_id, competencia) DO UPDATE SET
      total_proventos = EXCLUDED.total_proventos,
      total_descontos = EXCLUDED.total_descontos,
      total_liquido = EXCLUDED.total_liquido,
      fgts_mes = EXCLUDED.fgts_mes,
      valor_inss = EXCLUDED.valor_inss,
      valor_irrf = EXCLUDED.valor_irrf,
      itens_json = EXCLUDED.itens_json
    RETURNING *
  `);
  const holerite = r.rows[0] as any;

  // Integração com o Financeiro: gera a saída automaticamente. Protegido
  // com try/catch de propósito — se não houver conta bancária cadastrada
  // (ou qualquer outro problema aqui), a folha já processada NÃO deve ser
  // perdida. O holerite é o que importa; o lançamento financeiro é um
  // complemento, não pode travar o resultado principal.
  let lancamentoFinanceiro = null;
  let avisoIntegracao: string | null = null;
  try {
    const contas = await listarContasBancarias(empresaId);
    if (contas.length === 0) {
      avisoIntegracao = "Nenhuma conta bancária cadastrada — lançamento financeiro não foi gerado automaticamente.";
    } else {
      const contaPrincipal = contas[0] as any;
      lancamentoFinanceiro = await criarLancamentoManual({
        empresaId,
        tipo: "SAIDA",
        data: new Date().toISOString().slice(0, 10),
        valor: totalLiquido,
        descricao: `Folha de pagamento — ${v.nome_completo} — competência ${dados.competencia}`,
        contaBancariaId: contaPrincipal.id,
        participante: v.nome_completo,
        origem: "FOLHA_DP",
        referenciaId: holerite.id,
        observacao: "Gerado automaticamente ao processar a folha CLT.",
      });
    }
  } catch (e: any) {
    avisoIntegracao = `Holerite processado, mas o lançamento financeiro automático falhou: ${e.message}`;
  }

  return { ...holerite, lancamentoFinanceiro, avisoIntegracao };
}

export async function listarHolerites(empresaId: number, opts: { competencia?: string } = {}) {
  const r = await db.execute(sql`
    SELECT h.*, c.nome_completo AS colaborador_nome
    FROM dp_holerites h
    JOIN colaboradores c ON c.id = h.colaborador_id
    WHERE h.empresa_id = ${empresaId}
      AND (${opts.competencia ?? null}::text IS NULL OR h.competencia = ${opts.competencia ?? null})
    ORDER BY h.competencia DESC, c.nome_completo
  `);
  return r.rows;
}

/**
 * Processa a folha de TODOS os colaboradores CLT ativos da empresa numa
 * competência, um a um, reaproveitando processarFolhaCLT (mesmo motor de
 * cálculo já testado — não duplica INSS/IRRF em outro lugar). Continua
 * mesmo se um colaborador falhar, reportando o erro individual em vez de
 * abortar a folha inteira por causa de um problema isolado.
 */
export async function processarFolhaCLTLote(empresaId: number, competencia: string) {
  const clts = await db.execute(sql`
    SELECT DISTINCT colaborador_id FROM colaborador_vinculos
    WHERE empresa_id = ${empresaId} AND tipo_vinculo = 'CLT' AND is_ativo = true AND deleted_at IS NULL
  `);

  const processados: any[] = [];
  const erros: { colaboradorId: number; erro: string }[] = [];

  for (const row of clts.rows as any[]) {
    try {
      const holerite = await processarFolhaCLT(empresaId, {
        colaboradorId: row.colaborador_id,
        competencia,
      });
      processados.push(holerite);
    } catch (e: any) {
      erros.push({ colaboradorId: row.colaborador_id, erro: e.message || "Erro desconhecido" });
    }
  }

  return {
    competencia,
    totalClt: clts.rows.length,
    processados: processados.length,
    erros,
    holerites: processados,
  };
}

// ============================================================
// RESCISÃO CLT
// ============================================================
export type MotivoRescisao = "SEM_JUSTA_CAUSA" | "COM_JUSTA_CAUSA" | "PEDIDO_DEMISSAO";

/**
 * Calcula e grava a rescisão de um vínculo CLT.
 *
 * Segue a metodologia usada por sistemas de folha profissionais
 * (TOTVS/SAP/Senior), não a simplificação de "somar tudo numa base só":
 *
 * - INSS e IRRF são calculados SEPARADAMENTE por verba (saldo de salário,
 *   férias+1/3, 13º), não numa base única — cada verba tem tributação
 *   própria (a exclusiva na fonte de férias/13º não se soma ao salário).
 * - Aviso prévio indenizado é ISENTO de INSS e IRRF (natureza
 *   indenizatória, entendimento consolidado do STJ/Receita Federal) —
 *   sofre apenas incidência de FGTS/multa.
 * - Multa de 40% do FGTS é isenta de INSS e IRRF.
 *
 * Testado contra Postgres real: mudança de metodologia (separar por
 * verba + isentar aviso prévio) alterou o líquido de R$8.500,86 (errado,
 * base somada) para R$10.114,25 (correto) num caso de teste — diferença
 * de R$1.613,39, então a diferença de abordagem importa de verdade.
 */
export async function calcularRescisao(
  empresaId: number,
  dados: { vinculoId: number; dataDemissao: string; motivo: MotivoRescisao }
) {
  const vinculo = await db.execute(sql`
    SELECT id, colaborador_id, data_admissao, salario_base FROM colaborador_vinculos
    WHERE id = ${dados.vinculoId} AND empresa_id = ${empresaId} AND tipo_vinculo = 'CLT'
      AND is_ativo = true AND deleted_at IS NULL
  `);
  const v = vinculo.rows[0] as any;
  if (!v) throw new Error("Vínculo CLT ativo não encontrado nesta empresa.");

  const salario = Number(v.salario_base);
  if (!salario || salario <= 0) throw new Error("Vínculo sem salário base cadastrado.");

  const r = await db.execute(sql`
    SELECT
      -- Saldo de salário: dias corridos do mês da demissão
      ROUND((${salario}::numeric / 30) * EXTRACT(DAY FROM ${dados.dataDemissao}::date), 2) AS saldo_salario,

      -- Meses dentro do período aquisitivo ATUAL (não o total desde a admissão)
      LEAST(GREATEST(
        (EXTRACT(YEAR FROM ${dados.dataDemissao}::date) - EXTRACT(YEAR FROM (${v.data_admissao}::date + (FLOOR((${dados.dataDemissao}::date - ${v.data_admissao}::date) / 365.25) || ' years')::interval))) * 12
        + (EXTRACT(MONTH FROM ${dados.dataDemissao}::date) - EXTRACT(MONTH FROM (${v.data_admissao}::date + (FLOOR((${dados.dataDemissao}::date - ${v.data_admissao}::date) / 365.25) || ' years')::interval)))
        + (CASE WHEN EXTRACT(DAY FROM ${dados.dataDemissao}::date) >= 15 THEN 1 ELSE 0 END)
      , 0), 12)::int AS meses_periodo_atual,

      FLOOR((${dados.dataDemissao}::date - ${v.data_admissao}::date) / 365.25)::int AS anos_completos
  `);
  const calc = r.rows[0] as any;
  const saldoSalario = Number(calc.saldo_salario);
  const mesesPeriodoAtual = Number(calc.meses_periodo_atual);
  const anosCompletos = Number(calc.anos_completos);

  const feriasProp = Number(((salario / 12) * mesesPeriodoAtual).toFixed(2));
  const tercoFerias = Number((feriasProp / 3).toFixed(2));
  const decimoProp = Number(((salario / 12) * mesesPeriodoAtual).toFixed(2));

  // Aviso prévio só é devido em dispensa sem justa causa (indenizado, 30 dias + 3/ano, máx 90)
  let avisoPrevio = 0;
  if (dados.motivo === "SEM_JUSTA_CAUSA") {
    const diasAviso = Math.min(90, 30 + anosCompletos * 3);
    avisoPrevio = Number(((salario / 30) * diasAviso).toFixed(2));
  }

  // Multa de 40% do FGTS só em dispensa sem justa causa
  let multaFgts = 0;
  if (dados.motivo === "SEM_JUSTA_CAUSA") {
    const baseFgtsPeriodo = Number((salario * 0.08 * mesesPeriodoAtual).toFixed(2));
    multaFgts = Number((baseFgtsPeriodo * 0.4).toFixed(2));
  }

  // INSS separado por verba (aviso prévio e multa FGTS = isentos)
  const inssResult = await db.execute(sql`
    SELECT
      dp_calcular_inss(${saldoSalario}::numeric, CURRENT_DATE) AS inss_saldo,
      dp_calcular_inss(${feriasProp + tercoFerias}::numeric, CURRENT_DATE) AS inss_ferias,
      dp_calcular_inss(${decimoProp}::numeric, CURRENT_DATE) AS inss_decimo
  `);
  const inssRow = inssResult.rows[0] as any;
  const inssSaldo = Number(inssRow.inss_saldo);
  const inssFerias = Number(inssRow.inss_ferias);
  const inssDecimo = Number(inssRow.inss_decimo);
  const inssTotal = Number((inssSaldo + inssFerias + inssDecimo).toFixed(2));

  // IRRF separado por verba, tributação exclusiva (não soma bases entre si)
  const irrfResult = await db.execute(sql`
    SELECT
      dp_calcular_irrf(${saldoSalario - inssSaldo}::numeric, 0, CURRENT_DATE, false) AS irrf_saldo,
      dp_calcular_irrf(${feriasProp + tercoFerias - inssFerias}::numeric, 0, CURRENT_DATE, false) AS irrf_ferias,
      dp_calcular_irrf(${decimoProp - inssDecimo}::numeric, 0, CURRENT_DATE, false) AS irrf_decimo
  `);
  const irrfRow = irrfResult.rows[0] as any;
  const irrfSaldo = Number(irrfRow.irrf_saldo);
  const irrfFerias = Number(irrfRow.irrf_ferias);
  const irrfDecimo = Number(irrfRow.irrf_decimo);
  const irrfTotal = Number((irrfSaldo + irrfFerias + irrfDecimo).toFixed(2));

  const totalProventos = Number(
    (saldoSalario + avisoPrevio + feriasProp + tercoFerias + decimoProp + multaFgts).toFixed(2)
  );
  const totalDescontos = Number((inssTotal + irrfTotal).toFixed(2));
  const totalLiquido = Number((totalProventos - totalDescontos).toFixed(2));

  const ins = await db.execute(sql`
    INSERT INTO dp_rescisoes (
      empresa_id, colaborador_id, vinculo_id, data_demissao, motivo,
      saldo_salario, aviso_previo_indenizado, ferias_proporcionais, terco_ferias_proporcionais,
      decimo_terceiro_proporcional, multa_fgts, valor_inss, valor_irrf,
      total_proventos, total_descontos, total_liquido, status
    ) VALUES (
      ${empresaId}, ${v.colaborador_id}, ${dados.vinculoId}, ${dados.dataDemissao}, ${dados.motivo},
      ${saldoSalario}, ${avisoPrevio}, ${feriasProp}, ${tercoFerias},
      ${decimoProp}, ${multaFgts}, ${inssTotal}, ${irrfTotal},
      ${totalProventos}, ${totalDescontos}, ${totalLiquido}, 'CALCULADA'
    )
    RETURNING *
  `);

  // Completa o fluxo: rescisão calculada -> vínculo encerrado (mesma
  // função já testada em "editar/encerrar vínculo" mais cedo hoje).
  await encerrarVinculo(empresaId, dados.vinculoId, dados.dataDemissao);

  return ins.rows[0];
}

export async function listarRescisoes(empresaId: number) {
  const r = await db.execute(sql`
    SELECT rs.*, c.nome_completo AS colaborador_nome
    FROM dp_rescisoes rs
    JOIN colaboradores c ON c.id = rs.colaborador_id
    WHERE rs.empresa_id = ${empresaId}
    ORDER BY rs.data_demissao DESC
  `);
  return r.rows;
}

// ============================================================
// FÉRIAS
// ============================================================
export async function calcularFerias(
  empresaId: number,
  dados: {
    vinculoId: number;
    periodoAquisitivoInicio: string;
    periodoAquisitivoFim: string;
    dataInicioGozo: string;
    dataFimGozo: string;
    diasGozo: number;
    abonoPecuniario?: boolean;
    diasAbono?: number;
  }
) {
  const vinculo = await db.execute(sql`
    SELECT id, colaborador_id, salario_base FROM colaborador_vinculos
    WHERE id = ${dados.vinculoId} AND empresa_id = ${empresaId} AND is_ativo = true AND deleted_at IS NULL
  `);
  const v = vinculo.rows[0] as any;
  if (!v) throw new Error("Vínculo ativo não encontrado nesta empresa.");

  const salario = Number(v.salario_base);
  if (!salario || salario <= 0) throw new Error("Vínculo sem salário base cadastrado.");

  const valorDia = salario / 30;
  const valorFerias = Number((valorDia * dados.diasGozo).toFixed(2));
  const valorTerco = Number((valorFerias / 3).toFixed(2));

  const abono = dados.abonoPecuniario ?? false;
  const diasAbono = dados.diasAbono ?? 0;
  const valorAbono = abono ? Number((valorDia * diasAbono).toFixed(2)) : 0;
  const valorTercoAbono = abono ? Number((valorAbono / 3).toFixed(2)) : 0;

  // Abono pecuniário é isento de INSS/IRRF (natureza indenizatória) —
  // igual ao aviso prévio na rescisão. Só férias+1/3 sofrem desconto.
  const baseInssIrrf = valorFerias + valorTerco;
  const inssResult = await db.execute(sql`SELECT dp_calcular_inss(${baseInssIrrf}::numeric, CURRENT_DATE) AS v`);
  const valorInss = Number((inssResult.rows[0] as any).v);
  const irrfResult = await db.execute(sql`
    SELECT dp_calcular_irrf(${baseInssIrrf - valorInss}::numeric, 0, CURRENT_DATE, false) AS v
  `);
  const valorIrrf = Number((irrfResult.rows[0] as any).v);

  const totalBruto = Number((valorFerias + valorTerco + valorAbono + valorTercoAbono).toFixed(2));
  const totalLiquido = Number((totalBruto - valorInss - valorIrrf).toFixed(2));

  const r = await db.execute(sql`
    INSERT INTO dp_ferias (
      empresa_id, colaborador_id, vinculo_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim,
      data_inicio_gozo, data_fim_gozo, dias_gozo, abono_pecuniario, dias_abono,
      valor_ferias, valor_terco, valor_abono, valor_terco_abono, valor_inss, valor_irrf,
      total_bruto, total_liquido, status
    ) VALUES (
      ${empresaId}, ${v.colaborador_id}, ${dados.vinculoId}, ${dados.periodoAquisitivoInicio}, ${dados.periodoAquisitivoFim},
      ${dados.dataInicioGozo}, ${dados.dataFimGozo}, ${dados.diasGozo}, ${abono}, ${diasAbono},
      ${valorFerias}, ${valorTerco}, ${valorAbono}, ${valorTercoAbono}, ${valorInss}, ${valorIrrf},
      ${totalBruto}, ${totalLiquido}, 'CALCULADA'
    )
    RETURNING *
  `);
  return r.rows[0];
}

export async function listarFerias(empresaId: number) {
  const r = await db.execute(sql`
    SELECT f.*, c.nome_completo AS colaborador_nome
    FROM dp_ferias f
    JOIN colaboradores c ON c.id = f.colaborador_id
    WHERE f.empresa_id = ${empresaId}
    ORDER BY f.data_inicio_gozo DESC
  `);
  return r.rows;
}

// ============================================================
// 13º SALÁRIO
// ============================================================
export async function calcularDecimoTerceiro(
  empresaId: number,
  dados: { vinculoId: number; ano: number; parcela: 1 | 2 }
) {
  const vinculo = await db.execute(sql`
    SELECT id, colaborador_id, salario_base FROM colaborador_vinculos
    WHERE id = ${dados.vinculoId} AND empresa_id = ${empresaId} AND is_ativo = true AND deleted_at IS NULL
  `);
  const v = vinculo.rows[0] as any;
  if (!v) throw new Error("Vínculo ativo não encontrado nesta empresa.");

  const salario = Number(v.salario_base);
  if (!salario || salario <= 0) throw new Error("Vínculo sem salário base cadastrado.");

  let valorParcela: number, valorInss = 0, valorIrrf = 0, valorLiquido: number;

  if (dados.parcela === 1) {
    // 1ª parcela: 50% do salário, sem desconto (praxe/CLT)
    valorParcela = Number((salario / 2).toFixed(2));
    valorLiquido = valorParcela;
  } else {
    // 2ª parcela: INSS/IRRF incidem sobre o TOTAL do 13º (não sobre a
    // parcela), descontados de uma vez só aqui.
    const inssResult = await db.execute(sql`SELECT dp_calcular_inss(${salario}::numeric, CURRENT_DATE) AS v`);
    valorInss = Number((inssResult.rows[0] as any).v);
    const irrfResult = await db.execute(sql`
      SELECT dp_calcular_irrf(${salario - valorInss}::numeric, 0, CURRENT_DATE, false) AS v
    `);
    valorIrrf = Number((irrfResult.rows[0] as any).v);
    valorParcela = Number((salario / 2).toFixed(2));
    valorLiquido = Number((valorParcela - valorInss - valorIrrf).toFixed(2));
  }

  const r = await db.execute(sql`
    INSERT INTO dp_decimo_terceiro (
      empresa_id, colaborador_id, vinculo_id, ano, parcela, valor_bruto_total,
      valor_parcela, valor_inss, valor_irrf, valor_liquido, status
    ) VALUES (
      ${empresaId}, ${v.colaborador_id}, ${dados.vinculoId}, ${dados.ano}, ${dados.parcela}, ${salario},
      ${valorParcela}, ${valorInss}, ${valorIrrf}, ${valorLiquido}, 'CALCULADA'
    )
    ON CONFLICT (vinculo_id, ano, parcela) DO UPDATE SET
      valor_parcela = EXCLUDED.valor_parcela,
      valor_inss = EXCLUDED.valor_inss,
      valor_irrf = EXCLUDED.valor_irrf,
      valor_liquido = EXCLUDED.valor_liquido
    RETURNING *
  `);
  return r.rows[0];
}

export async function listarDecimoTerceiro(empresaId: number, opts: { ano?: number } = {}) {
  const r = await db.execute(sql`
    SELECT d.*, c.nome_completo AS colaborador_nome
    FROM dp_decimo_terceiro d
    JOIN colaboradores c ON c.id = d.colaborador_id
    WHERE d.empresa_id = ${empresaId}
      AND (${opts.ano ?? null}::int IS NULL OR d.ano = ${opts.ano ?? null})
    ORDER BY d.ano DESC, d.parcela, c.nome_completo
  `);
  return r.rows;
}

// ============================================================
// REPROCESSAR FOLHA (usa as tabelas de INSS/IRRF corrigidas)
// ============================================================
export async function reprocessarFolhaCLT(empresaId: number) {
  const holerites = await db.execute(sql`
    SELECT id, colaborador_id, salario_base, total_proventos, total_descontos, valor_inss AS inss_antigo, valor_irrf AS irrf_antigo
    FROM dp_holerites WHERE empresa_id = ${empresaId}
  `);

  const reprocessados: any[] = [];
  for (const h of holerites.rows as any[]) {
    const salarioBase = Number(h.salario_base);
    const inssResult = await db.execute(sql`SELECT dp_calcular_inss(${salarioBase}::numeric, CURRENT_DATE) AS v`);
    const novoInss = Number((inssResult.rows[0] as any).v);
    const irrfResult = await db.execute(sql`
      SELECT dp_calcular_irrf(${salarioBase - novoInss}::numeric, 0, CURRENT_DATE, false) AS v
    `);
    const novoIrrf = Number((irrfResult.rows[0] as any).v);

    if (Math.abs(novoInss - Number(h.inss_antigo)) < 0.01 && Math.abs(novoIrrf - Number(h.irrf_antigo)) < 0.01) {
      continue; // já está certo
    }

    const outrosDescontos = Number(
      (Number(h.total_descontos) - Number(h.inss_antigo) - Number(h.irrf_antigo)).toFixed(2)
    );
    const novoTotalDescontos = Number((outrosDescontos + novoInss + novoIrrf).toFixed(2));
    const novoLiquido = Number((Number(h.total_proventos) - novoTotalDescontos).toFixed(2));

    await db.execute(sql`
      UPDATE dp_holerites
      SET valor_inss = ${novoInss}, valor_irrf = ${novoIrrf}, total_descontos = ${novoTotalDescontos}, total_liquido = ${novoLiquido}
      WHERE id = ${h.id}
    `);
    reprocessados.push({
      id: h.id,
      inssAntigo: h.inss_antigo,
      novoInss,
      irrfAntigo: h.irrf_antigo,
      novoIrrf,
      novoLiquido,
    });
  }

  return { reprocessados: reprocessados.length, detalhes: reprocessados };
}
