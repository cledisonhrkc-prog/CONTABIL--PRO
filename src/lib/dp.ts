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
      is_ativo = COALESCE(${dados.isAtivo ?? null}, is_ativo),
      observacoes = COALESCE(${dados.observacoes ?? null}, observacoes)
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

  // ATENÇÃO: Escopo A não tem o motor de cálculo automático de INSS/IRRF
  // (isso é o Escopo B/C, com dp_calcular_inss/dp_calcular_irrf e as
  // tabelas de faixas progressivas). Aqui o contador informa os valores
  // já calculados por fora, e o sistema só registra e soma.
  const valorInss = Number((dados.valorInss ?? 0).toFixed(2));
  const valorIrrf = Number((dados.valorIrrf ?? 0).toFixed(2));
  const valorLiquido = Number((dados.valorBruto - valorInss - valorIrrf).toFixed(2));

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
    WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING *
  `);
  if (!r.rows[0]) throw new Error("Pagamento não encontrado nesta empresa.");
  return r.rows[0];
}
