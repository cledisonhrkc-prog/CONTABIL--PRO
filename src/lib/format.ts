export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const d = typeof dateStr === "string" ? new Date(dateStr + "T12:00:00") : dateStr;
  return d.toLocaleDateString("pt-BR");
}

export function formatDateInput(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
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
    CANCELADO: "bg-red-100 text-red-800",
    CONFIRMADO: "bg-green-100 text-green-800",
    PENDENTE: "bg-yellow-100 text-yellow-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}
