import { parseOFX, MovimentoOFX } from "./parserOFX";

interface LinhaExtrato {
  data: string;
  descricao: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  documento?: string;
}

function formatarDataYYYYMMDD(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Converte o resultado do parser OFX (tipo 'C'/'D') pro formato que
 * importarExtrato() espera (tipo 'ENTRADA'/'SAIDA').
 */
export function converterOFXParaLinhasExtrato(movimentos: MovimentoOFX[]): LinhaExtrato[] {
  return movimentos.map((m) => ({
    data: formatarDataYYYYMMDD(m.data),
    descricao: m.historico || "(sem descrição)",
    valor: m.valor,
    tipo: m.tipo === "C" ? "ENTRADA" : "SAIDA",
  }));
}

export function parseOFXParaLinhasExtrato(conteudoOFX: string): LinhaExtrato[] {
  return converterOFXParaLinhasExtrato(parseOFX(conteudoOFX));
}
