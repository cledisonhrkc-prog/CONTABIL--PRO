"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ArrowLeftRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface ContaBancaria {
  id: number;
  nome: string;
}

interface Transferencia {
  id: number;
  data: string;
  valor: string;
  conta_origem_nome?: string;
  conta_destino_nome?: string;
}

export default function TransferenciasPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [lista, setLista] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);
  const [contaOrigemId, setContaOrigemId] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/transferencias");
      const resData = await res.json();
      setLista(Array.isArray(resData) ? resData : resData?.value || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/financeiro/contas-bancarias")
      .then((r) => r.json())
      .then((d) => setContas(Array.isArray(d) ? d : d?.value || []))
      .catch(() => {});
    load();
  }, []);

  async function salvar() {
    if (!contaOrigemId || !contaDestinoId || !valor || !data) {
      setErro("Preencha conta de origem, destino, valor e data.");
      return;
    }
    if (contaOrigemId === contaDestinoId) {
      setErro("Conta de origem e destino não podem ser a mesma.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/financeiro/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contaOrigemId: Number(contaOrigemId),
          contaDestinoId: Number(contaDestinoId),
          valor: Number(valor),
          data,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData?.error || "Erro ao transferir.");
      setNova(false);
      setContaOrigemId("");
      setContaDestinoId("");
      setValor("");
      setData("");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao transferir.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Transferências</h1>
            <p className="text-indigo-100 text-sm mt-1">Entre contas bancárias</p>
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
              <Plus className="h-4 w-4" /> Nova Transferência
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8 space-y-5">
        {nova && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Nova Transferência</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Conta de origem</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={contaOrigemId}
                  onChange={(e) => setContaOrigemId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Conta de destino</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={contaDestinoId}
                  onChange={(e) => setContaDestinoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-sm text-slate-500 block mb-1">Data</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvando ? "Transferindo..." : "Transferir"}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-indigo-500" /> Transferências
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma transferência cadastrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">De → Para</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="py-2.5 text-slate-600">{t.data}</td>
                    <td className="py-2.5 font-medium text-slate-800">
                      {t.conta_origem_nome || "?"} → {t.conta_destino_nome || "?"}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900">R$ {Number(t.valor).toFixed(2)}</td>
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
