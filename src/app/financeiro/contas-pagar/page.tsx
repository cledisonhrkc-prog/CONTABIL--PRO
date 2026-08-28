"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ArrowUpCircle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface ContaPagar {
  id: number;
  participante: string;
  valor: string;
  data_vencimento: string;
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  ABERTO: "bg-amber-50 text-amber-700",
  PAGO: "bg-emerald-50 text-emerald-700",
  VENCIDO: "bg-red-50 text-red-700",
};

export default function ContasPagarPage() {
  const [lista, setLista] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);
  const [participante, setParticipante] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [baixandoId, setBaixandoId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/contas-pagar");
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
  }, []);

  async function salvar() {
    if (!participante || !valor || !dataVencimento) {
      setErro("Preencha participante, valor e vencimento.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/financeiro/contas-pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participante, valor: Number(valor), dataVencimento }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cadastrar conta.");
      setNova(false);
      setParticipante("");
      setValor("");
      setDataVencimento("");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao cadastrar conta.");
    } finally {
      setSalvando(false);
    }
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

  const totalAberto = lista.filter((c) => c.status !== "PAGO").reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Contas a Pagar</h1>
            <p className="text-indigo-100 text-sm mt-1">Total em aberto: R$ {totalAberto.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/financeiro"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button
              onClick={() => setNova(!nova)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              <Plus className="h-4 w-4" /> Nova Conta
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-8 space-y-5">
        {nova && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Nova Conta a Pagar</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Participante</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={participante}
                  onChange={(e) => setParticipante(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Vencimento</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                />
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-red-500" /> Contas a Pagar
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma conta a pagar cadastrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Participante</th>
                  <th className="pb-2">Vencimento</th>
                  <th className="pb-2 text-right">Valor</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{c.participante}</td>
                    <td className="py-2.5 text-slate-600">{c.data_vencimento}</td>
                    <td className="py-2.5 text-right font-bold text-red-600">R$ {Number(c.valor).toFixed(2)}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          STATUS_STYLE[c.status] || "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {c.status}
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
                          {baixandoId === c.id ? "..." : "Dar baixa"}
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
