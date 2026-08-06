// Parser universal — funciona tanto em Node.js (servidor) quanto no navegador.
// fast-xml-parser não tem dependências nativas, roda em qualquer lugar.
import { XMLParser } from "fast-xml-parser";

export type ItemNF = {
  cprod: string;
  xprod: string;
  ncm: string;
  cfop: string;
  qtd: number;
  vun: number;
  vprod: number;
  cst_pis: string;
  cst_cof: string;
};

export type NF = {
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  tipo_operacao: "SAIDA" | "ENTRADA";
  finalidade: "VENDA" | "COMPRA" | "SERVICO";
  data_emissao: string;
  crt: string;
  participante: string;
  cnpj_part: string;
  nome_empresa_propria: string;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_outras: number;
  valor_total: number;
  valor_icms: number;
  valor_icms_st: number;
  valor_ipi: number;
  valor_pis: number;
  valor_cofins: number;
  valor_iss: number;
  itens: ItemNF[];
  // Status SEFAZ:  100=Autorizada · 101=Cancelada · 110=Denegada · 150=Autorizada fora prazo · outros=diversos
  // Default 100 quando não vem no XML (NFe avulsa sem protocolo).
  cStat: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

function num(v: unknown, def = 0): number {
  if (v === undefined || v === null || v === "") return def;
  const n = parseFloat(String(v));
  return isNaN(n) ? def : n;
}

function digits(v: unknown): string {
  return String(v || "").replace(/\D/g, "");
}

function firstOf<T = unknown>(...vals: T[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseNfeXml(xml: string, cnpjEmpresa: string): NF {
  const obj = parser.parse(xml) as Record<string, unknown>;
  // Localize infNFe
  const root: unknown =
    (obj as { nfeProc?: { NFe?: { infNFe?: unknown } }; NFe?: { infNFe?: unknown } }).nfeProc?.NFe?.infNFe ??
    (obj as { NFe?: { infNFe?: unknown } }).NFe?.infNFe ??
    null;
  if (!root) throw new Error("infNFe não encontrado");
  const inf = root as Record<string, unknown>;
  const ide = (inf.ide ?? {}) as Record<string, unknown>;
  const emit = (inf.emit ?? {}) as Record<string, unknown>;
  const dest = (inf.dest ?? {}) as Record<string, unknown>;

  const chaveAttr = (inf["@_Id"] as string | undefined) || "";
  const chave = chaveAttr.replace(/^NFe/, "");
  const nNF = String(ide.nNF ?? "0");
  const serie = String(ide.serie ?? "1");
  const mod = String(ide.mod ?? "55");
  const tpNF = String(ide.tpNF ?? "1");
  const dhEmi = String(firstOf(ide.dhEmi, ide.dEmi) ?? "");
  const dataEmissao = dhEmi ? dhEmi.substring(0, 10) : "2024-01-01";

  const cnpjEmit = digits(firstOf(emit.CNPJ, emit.CPF));
  const nomeEmit = String(emit.xNome ?? "EMITENTE");
  const crt = String(emit.CRT ?? "");
  const cnpjDest = digits(firstOf(dest.CNPJ, dest.CPF));
  const nomeDest = String(dest.xNome ?? "CONSUMIDOR");

  const alvo = digits(cnpjEmpresa);
  let tipo_operacao: "SAIDA" | "ENTRADA";
  let participante: string;
  let cnpj_part: string;
  let nome_empresa_propria = "";
  if (cnpjEmit === alvo) {
    tipo_operacao = "SAIDA";
    participante = nomeDest;
    cnpj_part = cnpjDest;
    nome_empresa_propria = nomeEmit;
  } else if (cnpjDest === alvo) {
    tipo_operacao = "ENTRADA";
    participante = nomeEmit;
    cnpj_part = cnpjEmit;
    nome_empresa_propria = nomeDest;
  } else {
    tipo_operacao = tpNF === "1" ? "SAIDA" : "ENTRADA";
    participante = tipo_operacao === "SAIDA" ? nomeDest : nomeEmit;
    cnpj_part = tipo_operacao === "SAIDA" ? cnpjDest : cnpjEmit;
  }

  const totalObj = (inf.total ?? {}) as Record<string, unknown>;
  const t = (totalObj.ICMSTot ?? {}) as Record<string, unknown>;
  const v_prod = num(t.vProd);
  const v_icms = num(t.vICMS);
  const v_st = num(t.vST) || num(t.vICMSST);
  const v_ipi = num(t.vIPI);
  const v_pis = num(t.vPIS);
  const v_cofins = num(t.vCOFINS);
  const v_frete = num(t.vFrete);
  const v_seg = num(t.vSeg);
  const v_desc = num(t.vDesc);
  const v_outro = num(t.vOutro);
  let v_nf = num(t.vNF);

  const issqn = (totalObj.ISSQNtot ?? {}) as Record<string, unknown>;
  const v_iss = num(issqn.vISS);

  if (v_nf === 0) {
    v_nf = +(v_prod + v_ipi + v_st + v_frete + v_seg + v_outro - v_desc).toFixed(2);
  }

  const dets = toArray(inf.det as unknown);
  const itens: ItemNF[] = [];
  for (const d of dets) {
    const det = d as Record<string, unknown>;
    const prod = (det.prod ?? {}) as Record<string, unknown>;
    const imposto = (det.imposto ?? {}) as Record<string, unknown>;
    // CST PIS
    let cst_pis = "";
    const pisNode = imposto.PIS as Record<string, unknown> | undefined;
    if (pisNode) {
      for (const key of Object.keys(pisNode)) {
        const inner = pisNode[key] as Record<string, unknown> | undefined;
        if (inner && inner.CST) {
          cst_pis = String(inner.CST).padStart(2, "0");
          break;
        }
      }
    }
    let cst_cof = "";
    const cofNode = imposto.COFINS as Record<string, unknown> | undefined;
    if (cofNode) {
      for (const key of Object.keys(cofNode)) {
        const inner = cofNode[key] as Record<string, unknown> | undefined;
        if (inner && inner.CST) {
          cst_cof = String(inner.CST).padStart(2, "0");
          break;
        }
      }
    }
    itens.push({
      cprod: String(prod.cProd ?? "SEM_COD"),
      xprod: String(prod.xProd ?? "SEM_DESC").substring(0, 120),
      ncm: digits(prod.NCM),
      cfop: String(prod.CFOP ?? ""),
      qtd: num(prod.qCom),
      vun: num(prod.vUnCom),
      vprod: num(prod.vProd),
      cst_pis,
      cst_cof,
    });
  }

  let finalidade: "VENDA" | "COMPRA" | "SERVICO";
  if (v_iss > 0 && v_icms === 0) finalidade = "SERVICO";
  else finalidade = tipo_operacao === "SAIDA" ? "VENDA" : "COMPRA";

  // Status SEFAZ — vem em nfeProc.protNFe.infProt.cStat
  const nfeProc = (obj as { nfeProc?: { protNFe?: { infProt?: { cStat?: string | number } } } }).nfeProc;
  const cStatRaw = nfeProc?.protNFe?.infProt?.cStat;
  const cStat = cStatRaw != null ? String(cStatRaw) : "100"; // default = autorizada

  return {
    chave: chave || `${nNF}|${serie}|${v_nf}`,
    numero: nNF,
    serie,
    modelo: mod,
    cStat,
    tipo_operacao,
    finalidade,
    data_emissao: dataEmissao,
    crt,
    participante: participante || "DESCONHECIDO",
    cnpj_part: cnpj_part || "",
    nome_empresa_propria,
    valor_produtos: +v_prod.toFixed(2),
    valor_frete: +v_frete.toFixed(2),
    valor_seguro: +v_seg.toFixed(2),
    valor_desconto: +v_desc.toFixed(2),
    valor_outras: +v_outro.toFixed(2),
    valor_total: +v_nf.toFixed(2),
    valor_icms: +v_icms.toFixed(2),
    valor_icms_st: +v_st.toFixed(2),
    valor_ipi: +v_ipi.toFixed(2),
    valor_pis: +v_pis.toFixed(2),
    valor_cofins: +v_cofins.toFixed(2),
    valor_iss: +v_iss.toFixed(2),
    itens,
  };
}
