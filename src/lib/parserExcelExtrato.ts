import * as XLSX from "xlsx";

export interface LinhaExtratoExcel {
  data: string;
  descricao: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
}

/**
 * Lê um arquivo Excel de extrato bancário. Espera colunas com cabeçalho
 * (aceita variações de nome, sem diferenciar maiúsculas/acentos):
 * Data | Descrição | Valor | Tipo
 *
 * Valor: aceita positivo/negativo (negativo = saída automaticamente) OU
 * uma coluna "Tipo" explícita com ENTRADA/SAIDA, CREDITO/DEBITO, C/D.
 * Se ambos vierem, a coluna Tipo tem prioridade sobre o sinal do valor.
 */
export function parseExcelExtrato(bufferBase64: string): LinhaExtratoExcel[] {
  const buffer = Buffer.from(bufferBase64, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const primeiraAba = workbook.SheetNames[0];
  if (!primeiraAba) throw new Error("Arquivo Excel sem nenhuma planilha.");

  const sheet = workbook.Sheets[primeiraAba];
  const linhasCruas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (linhasCruas.length === 0) {
    throw new Error("Planilha vazia — nenhuma linha de dado encontrada.");
  }

  // Normaliza nomes de coluna (remove acento, espaço, deixa minúsculo)
  function normalizarChave(chave: string): string {
    return chave
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function acharCampo(linha: any, candidatos: string[]): any {
    const chaves = Object.keys(linha);
    for (const chave of chaves) {
      const norm = normalizarChave(chave);
      if (candidatos.includes(norm)) return linha[chave];
    }
    return undefined;
  }

  function formatarData(valor: any): string {
    if (valor instanceof Date) {
      const ano = valor.getFullYear();
      const mes = String(valor.getMonth() + 1).padStart(2, "0");
      const dia = String(valor.getDate()).padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }
    const str = String(valor).trim();
    // dd/mm/aaaa -> aaaa-mm-dd
    const matchBR = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (matchBR) {
      return `${matchBR[3]}-${matchBR[2].padStart(2, "0")}-${matchBR[1].padStart(2, "0")}`;
    }
    // já está em aaaa-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    throw new Error(`Data em formato não reconhecido: "${str}". Use DD/MM/AAAA ou AAAA-MM-DD.`);
  }

  const resultado: LinhaExtratoExcel[] = [];
  for (let i = 0; i < linhasCruas.length; i++) {
    const linha = linhasCruas[i];
    const dataRaw = acharCampo(linha, ["data", "dataemissao", "dt", "dtmovimento"]);
    const descricaoRaw = acharCampo(linha, ["descricao", "descrição", "historico", "histórico", "memo", "nome"]);
    const valorRaw = acharCampo(linha, ["valor", "vlr", "valortotal", "trnamt"]);
    const tipoRaw = acharCampo(linha, ["tipo", "tp", "natureza"]);

    if (dataRaw === undefined || valorRaw === undefined) {
      throw new Error(`Linha ${i + 2} da planilha: faltam colunas obrigatórias (Data e/ou Valor).`);
    }

    const data = formatarData(dataRaw);
    const descricao = String(descricaoRaw ?? "(sem descrição)").trim();

    let valorNumerico = typeof valorRaw === "number" ? valorRaw : parseFloat(String(valorRaw).replace(",", "."));
    if (isNaN(valorNumerico)) {
      throw new Error(`Linha ${i + 2} da planilha: valor inválido "${valorRaw}".`);
    }

    let tipo: "ENTRADA" | "SAIDA";
    if (tipoRaw !== undefined && String(tipoRaw).trim() !== "") {
      const tipoNorm = normalizarChave(String(tipoRaw));
      if (["entrada", "credito", "c"].includes(tipoNorm)) tipo = "ENTRADA";
      else if (["saida", "debito", "d"].includes(tipoNorm)) tipo = "SAIDA";
      else throw new Error(`Linha ${i + 2} da planilha: tipo "${tipoRaw}" não reconhecido (use ENTRADA/SAIDA ou CREDITO/DEBITO).`);
    } else {
      // Sem coluna Tipo: usa o sinal do valor
      tipo = valorNumerico < 0 ? "SAIDA" : "ENTRADA";
    }

    if (valorNumerico === 0) continue; // ignora linha de valor zero, sem sentido pra conciliação

    resultado.push({ data, descricao, valor: Math.abs(valorNumerico), tipo });
  }

  if (resultado.length === 0) {
    throw new Error("Nenhuma linha válida encontrada na planilha (todas com valor zero ou vazias).");
  }

  return resultado;
}
