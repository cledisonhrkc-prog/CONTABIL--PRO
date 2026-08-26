export interface MovimentoOFX {
  data: Date;
  valor: number;
  tipo: 'C' | 'D';
  historico: string;
}

/**
 * Parser de arquivo OFX (extrato bancário). Testado contra:
 * - Múltiplas transações num arquivo, formato padrão Money 100/102
 * - Valor decimal padrão OFX (ponto, sem separador de milhar)
 * - Tags NAME/MEMO com ou sem quebra de linha entre elas (bancos variam)
 * - Transações sem MEMO (só NAME)
 */
export function parseOFX(conteudoOFX: string): MovimentoOFX[] {
  const movimentos: MovimentoOFX[] = [];
  const regexTransacoes = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;
  while ((match = regexTransacoes.exec(conteudoOFX)) !== null) {
    const bloco = match[1];

    const dataMatch = bloco.match(/<DTPOSTED>(\d{8})/);
    const data = dataMatch
      ? new Date(
          parseInt(dataMatch[1].substring(0, 4)),
          parseInt(dataMatch[1].substring(4, 6)) - 1,
          parseInt(dataMatch[1].substring(6, 8))
        )
      : new Date();

    // OFX padrão sempre usa ponto decimal, sem separador de milhar —
    // NÃO fazer replace(',', '.') aqui, isso quebra silenciosamente
    // valores tipo "1.234,56" (viraria 1.234, perdendo os centavos reais).
    const valorMatch = bloco.match(/<TRNAMT>([-\d.]+)/);
    const valor = valorMatch ? parseFloat(valorMatch[1]) : 0;

    // Casa até a próxima tag "<", funciona com ou sem quebra de linha
    // entre as tags — bancos diferentes exportam formatado diferente.
    const nameMatch = bloco.match(/<NAME>([^<]*)/);
    const memoMatch = bloco.match(/<MEMO>([^<]*)/);
    const historico = `${nameMatch ? nameMatch[1].trim() : ""} ${memoMatch ? memoMatch[1].trim() : ""}`.trim();

    if (valor !== 0) {
      movimentos.push({ data, valor: Math.abs(valor), tipo: valor > 0 ? "C" : "D", historico });
    }
  }
  return movimentos;
}
