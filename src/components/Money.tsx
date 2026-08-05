export function fmtMoney(v: number, comSigla = true) {
  const s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sig = v < 0 ? "-" : "";
  return comSigla ? `${sig}R$ ${s}` : `${sig}${s}`;
}

export default function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={className}>{fmtMoney(value)}</span>;
}
