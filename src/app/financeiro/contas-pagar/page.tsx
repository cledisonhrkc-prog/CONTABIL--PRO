"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpCircle, Search } from "lucide-react";

export const dynamic = "force-dynamic";

interface ContaPagar {
  id: number;
  participante: string;
  descricao?: string;
  emissao: string;
  vencimento: string;
  valor: string;
  valorPago: string;
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  ABERTO: "bg-amber-50 text-amber-700",
  PARCIAL: "bg-blue-50 text-blue-700",
  PAGO: "bg-emerald-50 text-emerald-700",
  CANCELADO: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  PARCIAL: "Parcial",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

function formatCurrency(v: string | number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(v: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function ContasPagarPage() {
  const [lista, setLista] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("ABERTO,PARCIAL");
  const [busca, setBusca] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (busca) params.set("busca", busca);
      const res = await fetch(`/api/financeiro/contas-pagar?${params}`);
      const data = await res.json();
      setLista(Array.isArray(data) ? data : data?.value || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus]);

  function saldo(c: ContaPagar) {
    return Number(c.valor) - Number(c.valorPago || 0);
  }

  const totalAberto = lista
    .filter((c) => c.status === "ABERTO" || c.status === "PARCIAL")
    .reduce((s, c) => s + saldo(c), 0);

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Contas a Pagar</h1>
            <p className="text-indigo-100 text-sm mt-1">
              Total em aberto: {formatCurrency(totalAberto)}
            </p>
          </div>
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50"
          >
            <option value="ABERTO,PARCIAL">Em aberto</option>
            <option value="PAGO">Pagos</option>
            <option value="ABERTO,PARCIAL,PAGO">Todos</option>
            <option value="CANCELADO">Cancelados</option>
          </select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar fornecedor ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-slate-50"
            />
          </div>
          <button
            onClick={load}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Filtrar
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-red-500" /> Títulos de Fornecedores
          </h2>

          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma conta encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="pb-2 pr-3">Fornecedor</th>
                    <th className="pb-2 pr-3">Descrição</th>
                    <th className="pb-2 pr-3">Emissão</th>
                    <th className="pb-2 pr-3">Vencimento</th>
                    <th className="pb-2 pr-3 text-right">Valor</th>
                    <th className="pb-2 pr-3 text-right">Saldo</th>
                    <th className="pb-2 pr-3 text-center">Status</th>
                    <th className="pb-2 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{c.participante}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{c.descricao || "—"}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{formatDate(c.emissao)}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{formatDate(c.vencimento)}</td>
                      <td className="py-2.5 pr-3 text-right text-slate-700">{formatCurrency(c.valor)}</td>
                      <td className="py-2.5 pr-3 text-right font-bold text-red-600">
                        {formatCurrency(saldo(c))}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            STATUS_STYLE[c.status] || "bg-slate-50 text-slate-500"
                          }`}
                        >
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        {(c.status === "ABERTO" || c.status === "PARCIAL") && (
                          <Link
                            href={`/financeiro/contas-pagar/${c.id}/baixa`}
                            className="text-indigo-600 hover:underline text-xs font-medium"
                          >
                            Baixar
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
