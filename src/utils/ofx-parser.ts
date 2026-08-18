/**
 * Parser básico de OFX (padrão brasileiro de extrato bancário)
 * Suporta OFX 1.x e 2.x mais comuns dos bancos BR
 */

export interface TransacaoOFX {
  data: string; // YYYY-MM-DD
  valor: number;
  tipo: "CREDITO" | "DEBITO";
  descricao: string;
  documento?: string;
  hash: string;
}

export function parseOFX(conteudo: string): TransacaoOFX[] {
  const transacoes: TransacaoOFX[] = [];

  // Remove tags XML desnecessárias e normaliza
  const limpo = conteudo
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/\r\n/g, "\n");

  // Encontra blocos STMTTRN
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = regex.exec(limpo)) !== null) {
    const bloco = match[1];

    const trntype = extrairTag(bloco, "TRNTYPE") || "";
    const dtposted = extrairTag(bloco, "DTPOSTED") || "";
    const trnamt = extrairTag(bloco, "TRNAMT") || "0";
    const fitid = extrairTag(bloco, "FITID") || "";
    const memo = extrairTag(bloco, "MEMO") || extrairTag(bloco, "NAME") || "Sem descrição";
    const checknum = extrairTag(bloco, "CHECKNUM") || "";

    const data = parseDataOFX(dtposted);
    const valorAbs = Math.abs(parseFloat(trnamt.replace(",", ".")));
    const isCredito =
      trntype.toUpperCase() === "CREDIT" ||
      trntype.toUpperCase() === "DEP" ||
      parseFloat(trnamt) > 0;

    const hash = fitid || `${data}|${trnamt}|${memo.substring(0, 40)}`;

    transacoes.push({
      data,
      valor: Number(valorAbs.toFixed(2)),
      tipo: isCredito ? "CREDITO" : "DEBITO",
      descricao: memo.trim(),
      documento: checknum || fitid || undefined,
      hash,
    });
  }

  return transacoes;
}

function extrairTag(bloco: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<]*)`, "i");
  const m = bloco.match(re);
  return m ? m[1].trim() : null;
}

function parseDataOFX(dt: string): string {
  // Formatos comuns: 20240815  ou 20240815120000  ou 20240815120000[-3:BRT]
  const limpa = dt.replace(/\[.*\]/, "").trim();
  if (limpa.length >= 8) {
    const y = limpa.substring(0, 4);
    const m = limpa.substring(4, 6);
    const d = limpa.substring(6, 8);
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parser simples de CSV bancário (formato genérico)
 * Espera colunas: data;descricao;valor  ou data,descricao,valor
 */
export function parseCSVBancario(conteudo: string): TransacaoOFX[] {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim());
  const transacoes: TransacaoOFX[] = [];

  // Detecta separador
  const separador = linhas[0].includes(";") ? ";" : ",";

  for (let i = 0; i < linhas.length; i++) {
    const cols = linhas[i].split(separador).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) continue;

    // Tenta detectar se é cabeçalho
    if (i === 0 && /data|date|descri/i.test(cols[0])) continue;

    let dataStr = cols[0];
    let descricao = cols[1];
    let valorStr = cols[2];

    // Alguns bancos colocam valor na última coluna
    if (cols.length > 3 && /^-?[\d.,]+$/.test(cols[cols.length - 1])) {
      valorStr = cols[cols.length - 1];
      descricao = cols.slice(1, -1).join(" ");
    }

    // Normaliza data (dd/mm/yyyy ou yyyy-mm-dd)
    let data = dataStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
      const [d, m, y] = dataStr.split("/");
      data = `${y}-${m}-${d}`;
    }

    const valorNum = parseFloat(
      valorStr.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")
    );
    if (isNaN(valorNum)) continue;

    const tipo = valorNum >= 0 ? "CREDITO" : "DEBITO";
    const hash = `${data}|${valorNum}|${descricao.substring(0, 40)}`;

    transacoes.push({
      data,
      valor: Math.abs(Number(valorNum.toFixed(2))),
      tipo,
      descricao: descricao || "Sem descrição",
      hash,
    });
  }

  return transacoes;
}
