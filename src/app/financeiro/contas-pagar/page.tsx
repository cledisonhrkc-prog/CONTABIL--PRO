"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, statusLabel, statusColor } from "@/utils/format";
import { ArrowLeft, Search, ArrowUpCircle, CheckCircle2 } from "lucide-react";

interface Conta {
  id: number;
  participante: string;
  descricao?: string;
  emissao: string;
  vencimento: string;
  valor: string;
  valorPago: string;
  status: string;
}

export default function ContasPagarPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("ABERTO,PARCIAL");
  const [busca, setBusca] = useState("");
  const [baixandoId, setBaixandoId] = useState<number | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus]);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (busca) params.set("busca", busca);
      const res = await fetch(`/api/financeiro/contas-pagar?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ao carregar contas (${res.status})`);
      setContas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      setErro(e.message || "Erro ao carregar contas a pagar.");
    } finally {
      setLoading(false);
    }
  }

  function saldo(c: Conta) {
    return Number(c.valor) - Number(c.valorPago || 0);
  }

  async function baixar(id: number) {
    setBaixandoId(id);
    try {
      const res = await fetch(`/api/financeiro/contas-pagar/${id}/baixar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao dar baixa.");
      }
      await load();
    } catch (e: any) {
      alert(e.message || "Erro ao dar baixa.");
    } finally {
      setBaixandoId(null);
    }
  }

  const totalEmAberto = contas.reduce((s, c) => s + saldo(c), 0);

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Contas a Pagar</h1>
            <p className="text-indigo-100 text-sm mt-1">
              Títulos de fornecedores — R$ {totalEmAberto.toFixed(2)} em aberto
            </p>
          </div>
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar fornecedor ou descrição..."
                className="w-full pl-9 border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="ABERTO,PARCIAL">Em aberto</option>
              <option value="PAGO">Pago</option>
              <option value="">Todos</option>
            </select>
            <button
              onClick={load}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
            >
              Filtrar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-red-500" /> Contas
          </h2>
          {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma conta encontrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Fornecedor</th>
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Emissão</th>
                  <th className="pb-2">Vencimento</th>
                  <th className="pb-2 text-right">Valor</th>
                  <th className="pb-2 text-right">Saldo</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{c.participante}</td>
                    <td className="py-2.5 text-slate-500">{c.descricao || "—"}</td>
                    <td className="py-2.5 text-slate-600">{formatDate(c.emissao)}</td>
                    <td className="py-2.5 text-slate-600">{formatDate(c.vencimento)}</td>
                    <td className="py-2.5 text-right text-slate-700">{formatCurrency(Number(c.valor))}</td>
                    <td className="py-2.5 text-right font-bold text-red-600">{formatCurrency(saldo(c))}</td>
                    <td className="py-2.5 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      {c.status !== "PAGO" && (
                        <button
                          onClick={() => baixar(c.id)}
                          disabled={baixandoId === c.id}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline text-xs disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {baixandoId === c.id ? "..." : "Baixar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
