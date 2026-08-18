/**
 * Utilitários de formatação — Brasil
 */

export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : date;
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR");
}

export function parseCurrency(value: string): number {
  const cleaned = value
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(cleaned) || 0;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ABERTO: "Aberto",
    PARCIAL: "Parcial",
    PAGO: "Pago",
    CANCELADO: "Cancelado",
    CONFIRMADO: "Confirmado",
    PENDENTE: "Pendente",
  };
  return map[status] || status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ABERTO: "bg-yellow-100 text-yellow-800",
    PARCIAL: "bg-blue-100 text-blue-800",
    PAGO: "bg-green-100 text-green-800",
    CANCELADO: "bg-gray-100 text-gray-600",
    CONFIRMADO: "bg-green-100 text-green-800",
    PENDENTE: "bg-yellow-100 text-yellow-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}

export function tipoLancamentoLabel(tipo: string): string {
  const map: Record<string, string> = {
    ENTRADA: "Entrada",
    SAIDA: "Saída",
    TRANSFERENCIA: "Transferência",
  };
  return map[tipo] || tipo;
}

export const formaPagamentoOptions = [
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "TED", label: "TED / Transferência" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO", label: "Cartão" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OUTRO", label: "Outro" },
];
