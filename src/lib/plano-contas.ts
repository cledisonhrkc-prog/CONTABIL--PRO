// Plano de contas padrão - baseado no SIGC v4.1.2

export type ContaPlano = {
  codigo: string;
  descricao: string;
  tipo: "ATIVO" | "PASSIVO" | "PATRIMONIO_LIQUIDO" | "RECEITA" | "CUSTO" | "DESPESA" | "RESULTADO";
  natureza: "DEVEDORA" | "CREDITORA";
  nivel: number;
  conta_pai: string | null;
};

export const PLANO_CONTAS_PADRAO: ContaPlano[] = [
  // ATIVO
  { codigo: "1", descricao: "ATIVO", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 1, conta_pai: null },
  { codigo: "1.1", descricao: "ATIVO CIRCULANTE", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 2, conta_pai: "1" },
  { codigo: "1.1.01.01", descricao: "CAIXA GERAL", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.01.02", descricao: "BANCOS CONTA MOVIMENTO", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.02.01", descricao: "CLIENTES", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.03.01", descricao: "ESTOQUES DE MERCADORIAS", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.01", descricao: "ICMS A RECUPERAR", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.02", descricao: "IPI A RECUPERAR", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.03", descricao: "PIS A RECUPERAR", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.04", descricao: "COFINS A RECUPERAR", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.07", descricao: "ISS A RECUPERAR", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.10", descricao: "CBS A RECUPERAR (Reforma 2027)", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },
  { codigo: "1.1.04.11", descricao: "IBS A RECUPERAR (Reforma 2033)", tipo: "ATIVO", natureza: "DEVEDORA", nivel: 4, conta_pai: "1.1" },

  // PASSIVO
  { codigo: "2", descricao: "PASSIVO", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 1, conta_pai: null },
  { codigo: "2.1", descricao: "PASSIVO CIRCULANTE", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 2, conta_pai: "2" },
  { codigo: "2.1.01.01", descricao: "FORNECEDORES", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.01", descricao: "ICMS A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.02", descricao: "IPI A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.03", descricao: "PIS A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.04", descricao: "COFINS A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.05", descricao: "ISS A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.06", descricao: "IRPJ A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.07", descricao: "CSLL A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.08", descricao: "ICMS-ST A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.09", descricao: "DAS SIMPLES NACIONAL A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.10", descricao: "CBS A PAGAR (Reforma 2027)", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.11", descricao: "IBS A PAGAR (Reforma 2033)", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },
  { codigo: "2.1.03.12", descricao: "IS - IMPOSTO SELETIVO A PAGAR", tipo: "PASSIVO", natureza: "CREDITORA", nivel: 4, conta_pai: "2.1" },

  // PATRIMÔNIO LÍQUIDO
  { codigo: "3", descricao: "PATRIMONIO LIQUIDO", tipo: "PATRIMONIO_LIQUIDO", natureza: "CREDITORA", nivel: 1, conta_pai: null },
  { codigo: "3.1.01", descricao: "CAPITAL SOCIAL", tipo: "PATRIMONIO_LIQUIDO", natureza: "CREDITORA", nivel: 4, conta_pai: "3" },
  { codigo: "3.5.01", descricao: "LUCROS/PREJUIZOS ACUMULADOS", tipo: "PATRIMONIO_LIQUIDO", natureza: "CREDITORA", nivel: 4, conta_pai: "3" },

  // RECEITAS
  { codigo: "4", descricao: "RECEITAS", tipo: "RECEITA", natureza: "CREDITORA", nivel: 1, conta_pai: null },
  { codigo: "4.1.01", descricao: "VENDAS DE MERCADORIAS", tipo: "RECEITA", natureza: "CREDITORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.1.03", descricao: "VENDAS DE SERVICOS", tipo: "RECEITA", natureza: "CREDITORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.01", descricao: "(-) ICMS SOBRE VENDAS", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.02", descricao: "(-) PIS SOBRE VENDAS", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.03", descricao: "(-) COFINS SOBRE VENDAS", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.04", descricao: "(-) DESCONTOS CONCEDIDOS", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.05", descricao: "(-) ISS SOBRE SERVICOS", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.06", descricao: "(-) IPI SOBRE VENDAS", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.08", descricao: "(-) DAS SIMPLES NACIONAL", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.09", descricao: "(-) CBS SOBRE VENDAS (Reforma 2027)", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.10", descricao: "(-) IBS SOBRE VENDAS (Reforma 2033)", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },
  { codigo: "4.2.11", descricao: "(-) IMPOSTO SELETIVO (IS)", tipo: "RECEITA", natureza: "DEVEDORA", nivel: 4, conta_pai: "4" },

  // CUSTOS
  { codigo: "5", descricao: "CUSTOS", tipo: "CUSTO", natureza: "DEVEDORA", nivel: 1, conta_pai: null },
  { codigo: "5.1.01", descricao: "CMV - CUSTO DAS MERCADORIAS VENDIDAS", tipo: "CUSTO", natureza: "DEVEDORA", nivel: 4, conta_pai: "5" },

  // DESPESAS
  { codigo: "6", descricao: "DESPESAS", tipo: "DESPESA", natureza: "DEVEDORA", nivel: 1, conta_pai: null },
  { codigo: "6.2.22", descricao: "SERVICOS DE TERCEIROS", tipo: "DESPESA", natureza: "DEVEDORA", nivel: 4, conta_pai: "6" },
  { codigo: "6.3.05", descricao: "IRPJ - DESPESA", tipo: "DESPESA", natureza: "DEVEDORA", nivel: 4, conta_pai: "6" },
  { codigo: "6.3.06", descricao: "CSLL - DESPESA", tipo: "DESPESA", natureza: "DEVEDORA", nivel: 4, conta_pai: "6" },

  // RESULTADO
  { codigo: "7", descricao: "RESULTADO", tipo: "RESULTADO", natureza: "CREDITORA", nivel: 1, conta_pai: null },
  { codigo: "7.1.01", descricao: "APURACAO DO RESULTADO", tipo: "RESULTADO", natureza: "CREDITORA", nivel: 4, conta_pai: "7" },
];
