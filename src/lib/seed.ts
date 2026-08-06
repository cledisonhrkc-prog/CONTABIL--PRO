// Gera 1000 NF-e fictícias variadas para stress-test do sistema
import { NF, ItemNF } from "./nfe-parser";
import { MONO_NCM } from "./simples";

const PRODUTOS: Array<{ desc: string; ncm: string; preco: number }> = [
  { desc: "SMARTPHONE SAMSUNG A54", ncm: "85171231", preco: 1899.9 },
  { desc: "NOTEBOOK DELL INSPIRON", ncm: "84713012", preco: 4299.0 },
  { desc: "MONITOR LG 24 POLEGADAS", ncm: "85285210", preco: 899.0 },
  { desc: "CADEIRA DE ESCRITORIO", ncm: "94013000", preco: 649.9 },
  { desc: "PAPEL A4 500 FLS", ncm: "48025690", preco: 29.9 },
  { desc: "AGUA MINERAL 500ML", ncm: "22021000", preco: 3.5 }, // monofásico
  { desc: "REFRIGERANTE COLA 2L", ncm: "22029900", preco: 8.9 }, // monofásico
  { desc: "MEDICAMENTO GENERICO", ncm: "30049099", preco: 45.6 }, // monofásico
  { desc: "SHAMPOO ANTICASPA", ncm: "33051000", preco: 22.9 },
  { desc: "PERFUME NACIONAL", ncm: "33059000", preco: 189.9 }, // monofásico
  { desc: "CIGARRO MACO", ncm: "24022000", preco: 12.5 }, // monofásico
  { desc: "OLEO DE MOTOR", ncm: "27101259", preco: 79.9 }, // monofásico
  { desc: "PARAFUSO 6MM", ncm: "73181500", preco: 0.85 },
  { desc: "CIMENTO CP II 50KG", ncm: "25232910", preco: 39.9 },
  { desc: "TINTA LATEX BRANCA 18L", ncm: "32091010", preco: 259.9 },
  { desc: "ARROZ 5KG TIPO 1", ncm: "10063021", preco: 28.9 },
  { desc: "FEIJAO CARIOCA 1KG", ncm: "07133399", preco: 9.9 },
  { desc: "ACUCAR CRISTAL 1KG", ncm: "17019900", preco: 4.5 },
  { desc: "CAFE TORRADO 500G", ncm: "09012100", preco: 22.9 },
  { desc: "LEITE UHT 1L", ncm: "04012000", preco: 5.9 },
  { desc: "SERVICO DE CONSULTORIA", ncm: "00000000", preco: 2500.0 },
  { desc: "SERVICO DE TI - MENSAL", ncm: "00000000", preco: 1800.0 },
  { desc: "MANUTENCAO PREDIAL", ncm: "00000000", preco: 950.0 },
];

const FORNECEDORES = [
  { nome: "DISTRIBUIDORA CENTRAL LTDA", cnpj: "11222333000144" },
  { nome: "COMERCIAL ABC S.A.", cnpj: "22333444000155" },
  { nome: "ATACADO MODELO LTDA", cnpj: "33444555000166" },
  { nome: "FORNECEDOR ALPHA ME", cnpj: "44555666000177" },
  { nome: "BETA IMPORTS EIRELI", cnpj: "55666777000188" },
  { nome: "GAMMA INDUSTRIA LTDA", cnpj: "66777888000199" },
  { nome: "DELTA COMERCIO LTDA", cnpj: "77888999000110" },
  { nome: "PRESTADORA SIGMA ME", cnpj: "88999000000121" },
];

const CLIENTES = [
  { nome: "MARIA DA SILVA", cnpj: "12345678901" },
  { nome: "JOAO PEREIRA", cnpj: "98765432100" },
  { nome: "EMPRESA XPTO LTDA", cnpj: "10203040000150" },
  { nome: "COMERCIO KAPPA S.A.", cnpj: "20304050000161" },
  { nome: "REVENDA LAMBDA ME", cnpj: "30405060000172" },
  { nome: "CONSUMIDOR FINAL", cnpj: "" },
  { nome: "ATACADISTA ZETA", cnpj: "40506070000183" },
];

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function rndInt(min: number, max: number) {
  return Math.floor(rnd(min, max + 1));
}
function choice<T>(arr: T[]): T {
  return arr[rndInt(0, arr.length - 1)];
}
function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

function dataAleatoriaAno(ano: number): string {
  const mes = rndInt(1, 12);
  const dia = rndInt(1, 28);
  return `${ano}-${pad(mes, 2)}-${pad(dia, 2)}`;
}

// Distribui uniformemente as notas entre os anos do intervalo
function anoDaNota(indice: number, total: number, anoIni: number, anoFim: number): number {
  const anos = anoFim - anoIni + 1;
  const porAno = Math.max(1, Math.floor(total / anos));
  const idx = Math.floor(indice / porAno);
  return Math.min(anoIni + idx, anoFim);
}

function calcImpostos(vtot: number, tipo: "SAIDA" | "ENTRADA", finalidade: "VENDA" | "COMPRA" | "SERVICO") {
  if (finalidade === "SERVICO") {
    const iss = +(vtot * 0.05).toFixed(2);
    const pis = +(vtot * 0.0065).toFixed(2);
    const cof = +(vtot * 0.03).toFixed(2);
    return { icms: 0, ipi: 0, pis, cof, iss, st: 0 };
  }
  const icms = +(vtot * 0.18).toFixed(2);
  const ipi = tipo === "ENTRADA" ? +(vtot * 0.05).toFixed(2) : 0;
  const pis = +(vtot * 0.0165).toFixed(2);
  const cof = +(vtot * 0.076).toFixed(2);
  const st = Math.random() < 0.15 ? +(vtot * 0.08).toFixed(2) : 0;
  return { icms, ipi, pis, cof, iss: 0, st };
}

function gerarChave(uf: number, aamm: string, cnpj: string, mod: string, serie: string, nnf: string) {
  // 44 chars pseudo (não valida DV)
  const cnf = String(rndInt(10000000, 99999999));
  const raw = `${pad(uf, 2)}${aamm}${cnpj.padStart(14, "0")}${mod}${pad(Number(serie), 3)}${pad(Number(nnf), 9)}1${cnf}0`;
  return raw.substring(0, 43) + "0";
}

export type SeedOptions = {
  cnpjEmpresa: string;
  nomeEmpresa: string;
  qtd?: number;
  anoInicio?: number;
  anoFim?: number;
  incluirServicos?: boolean;
  probEntrada?: number;
  probMonofasicoErrado?: number;
};

export function gerarNotasFake(opts: SeedOptions): NF[] {
  const qtd = opts.qtd ?? 1000;
  const anoIni = opts.anoInicio ?? new Date().getFullYear() - 1;
  const anoFim = opts.anoFim ?? new Date().getFullYear();
  const probEntrada = opts.probEntrada ?? 0.35;
  const probMonoErr = opts.probMonofasicoErrado ?? 0.08;
  const incluirServ = opts.incluirServicos !== false;

  const notas: NF[] = [];
  const cnpjEmp = opts.cnpjEmpresa.replace(/\D/g, "");

  for (let i = 1; i <= qtd; i++) {
    // Distribui igualmente entre os anos do intervalo (útil para testar
    // pré-reforma, transição 2026 e reforma 2027 no mesmo lote)
    const ano = anoDaNota(i - 1, qtd, anoIni, anoFim);
    const dt = dataAleatoriaAno(ano);
    const isEntrada = Math.random() < probEntrada;
    const isServico = incluirServ && Math.random() < 0.12;
    const finalidade: "VENDA" | "COMPRA" | "SERVICO" = isServico
      ? "SERVICO"
      : isEntrada
      ? "COMPRA"
      : "VENDA";

    // Itens
    const qtdItens = rndInt(1, 6);
    const itens: ItemNF[] = [];
    let vProd = 0;
    for (let k = 0; k < qtdItens; k++) {
      let p = choice(PRODUTOS);
      if (isServico) {
        p = PRODUTOS.find((x) => x.ncm === "00000000") || p;
      } else if (isServico === false && p.ncm === "00000000") {
        p = PRODUTOS.find((x) => x.ncm !== "00000000") || p;
      }
      const q = rndInt(1, 20);
      const vun = +(p.preco * rnd(0.9, 1.15)).toFixed(2);
      const vt = +(q * vun).toFixed(2);
      let cstPis = "01";
      let cstCof = "01";
      if (MONO_NCM.has(p.ncm)) {
        // 8% chance de CST errado (deveria ser 04 mas está 01/02)
        if (Math.random() < probMonoErr) {
          cstPis = choice(["01", "02"]);
          cstCof = choice(["01", "02"]);
        } else {
          cstPis = "04";
          cstCof = "04";
        }
      }
      itens.push({
        cprod: `P${pad(k + 1, 3)}`,
        xprod: p.desc,
        ncm: p.ncm,
        cfop: isEntrada ? "5102" : "5102",
        qtd: q,
        vun,
        vprod: vt,
        cst_pis: cstPis,
        cst_cof: cstCof,
      });
      vProd += vt;
    }
    vProd = +vProd.toFixed(2);
    const tipo: "SAIDA" | "ENTRADA" = isEntrada ? "ENTRADA" : "SAIDA";
    const imp = calcImpostos(vProd, tipo, finalidade);
    const vFrete = Math.random() < 0.3 ? +(vProd * 0.02).toFixed(2) : 0;
    const vDesc = Math.random() < 0.2 ? +(vProd * rnd(0.01, 0.05)).toFixed(2) : 0;
    const vTot = +(vProd + vFrete + imp.st - vDesc + imp.ipi).toFixed(2);
    const participante = isEntrada ? choice(FORNECEDORES) : choice(CLIENTES);
    const nNF = String(i);
    const serie = "1";
    const mod = "55";
    const uf = 35; // SP
    const aamm = dt.substring(2, 4) + dt.substring(5, 7);
    const chave = gerarChave(uf, aamm, isEntrada ? participante.cnpj : cnpjEmp, mod, serie, nNF);

    notas.push({
      chave,
      numero: nNF,
      serie,
      modelo: mod,
      cStat: "100", // demo: sempre autorizadas
      tipo_operacao: tipo,
      finalidade,
      data_emissao: dt,
      crt: "1",
      participante: participante.nome,
      cnpj_part: participante.cnpj,
      nome_empresa_propria: opts.nomeEmpresa,
      valor_produtos: vProd,
      valor_frete: vFrete,
      valor_seguro: 0,
      valor_desconto: vDesc,
      valor_outras: 0,
      valor_total: vTot,
      valor_icms: imp.icms,
      valor_icms_st: imp.st,
      valor_ipi: imp.ipi,
      valor_pis: imp.pis,
      valor_cofins: imp.cof,
      valor_iss: imp.iss,
      itens,
    });
  }
  return notas;
}
