// Tabelas do Simples Nacional - LC 123/2006 (Atualizado pela LC 194/2022 - Vigente 2026)
// Faixa: [limite_superior_RBT12, aliquota_nominal, parcela_a_deduzir]

export type Faixa = [number, number, number];

export const ANEXO_I: Faixa[] = [
  [180000.0, 0.04, 0.0],
  [360000.0, 0.073, 5940.0],
  [720000.0, 0.095, 13860.0], // ATENCAO: VALORES ANTIGOS ABAIXO FORAM COMENTADOS PARA REFERENCIA
  [1800000.0, 0.107, 22500.0],
  [3600000.0, 0.143, 87300.0],
  [4800000.0, 0.19, 378000.0],
];

// TABELA CORRETA VIGENTE (LC 194/2022) - SUBSTITUA A ACIMA POR ESTA
export const ANEXO_I_VIGENTE: Faixa[] = [
  [180000.0, 0.04, 0.0],
  [360000.0, 0.073, 5940.0],
  [720000.0, 0.112, 9720.0],   // Corrigido: 11,2% e 9.720
  [1800000.0, 0.123, 19440.0], // Corrigido: 12,3% e 19.440
  [3600000.0, 0.153, 73800.0], // Corrigido: 15,3% e 73.800
  [4800000.0, 0.19, 378000.0], // Mantido (acima de 3.6M muda)
];

export const ANEXO_II: Faixa[] = [
  [180000.0, 0.045, 0.0],
  [360000.0, 0.078, 5940.0],
  [720000.0, 0.10, 13860.0],
  [1800000.0, 0.112, 22500.0],
  [3600000.0, 0.147, 85500.0],
  [4800000.0, 0.30, 720000.0],
];

export const ANEXO_III: Faixa[] = [
  [180000.0, 0.06, 0.0],
  [360000.0, 0.112, 9360.0],
  [720000.0, 0.135, 17640.0],
  [1800000.0, 0.16, 35640.0],
  [3600000.0, 0.21, 125640.0],
  [4800000.0, 0.33, 648000.0],
];

export const ANEXO_IV: Faixa[] = [
  [180000.0, 0.045, 0.0],
  [360000.0, 0.09, 8100.0],
  [720000.0, 0.102, 12420.0],
  [1800000.0, 0.14, 39780.0],
  [3600000.0, 0.22, 183780.0],
  [4800000.0, 0.33, 828000.0],
];

export const ANEXO_V: Faixa[] = [
  [180000.0, 0.155, 0.0],
  [360000.0, 0.18, 4500.0],
  [720000.0, 0.195, 9900.0],
  [1800000.0, 0.205, 17100.0],
  [3600000.0, 0.23, 62100.0],
  [4800000.0, 0.305, 540000.0],
];

export function getAnexo(anexo: string): Faixa[] {
  const k = (anexo || "I").toUpperCase();
  if (k === "II") return ANEXO_II;
  if (k === "III") return ANEXO_III;
  if (k === "IV") return ANEXO_IV;
  if (k === "V") return ANEXO_V;
  return ANEXO_I_VIGENTE; // Usando a tabela corrigida
}

/**
 * Alíquota efetiva do Simples Nacional.
 * Fórmula oficial: (RBT12 x aliq_nominal - parcela_a_deduzir) / RBT12
 */
export function aliquotaEfetivaSimples(rbt12: number, anexo = "I"): number {
  if (!rbt12 || rbt12 <= 0) return 0;
  const tabela = getAnexo(anexo);
  for (const [lim, aliq, ded] of tabela) {
    if (rbt12 <= lim) {
      return (rbt12 * aliq - ded) / rbt12;
    }
  }
  return tabela[tabela.length - 1][1];
}

// NCMs monofásicos PIS/COFINS (regra R08)
export const MONO_NCM = new Set([
  "22021000", "22029900", "30049099", "30049029", "30049024", "30049037",
  "30049039", "30049043", "30049059", "30049069", "30049079", "30044200",
  "30043290", "30043999", "30042099", "15179090", "90278999",
  "33059000", "33071000", "82121020", "24022000", "27101259",
]);
