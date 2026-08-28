"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

interface ContaBancaria {
  id: number;
  nome: string;
  banco?: string;
  saldo_inicial?: string;
  ativa?: boolean;
}

export default function ContasBancariasPage() {
  const [lista, setLista] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/contas-bancarias");
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
    if (!nome) {
      setErro("Informe o nome da conta.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/financeiro/contas-bancarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, banco, saldoInicial: Number(saldoInicial) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cadastrar conta.");
      setNova(false);
      setNome("");
      setBanco("");
      setSaldoInicial("0");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao cadastrar conta.");
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
            <h1 className="text-white text-2xl font-bold mt-0.5">Contas Bancárias</h1>
            <p className="text-indigo-100 text-sm mt-1">{lista.length} conta(s) cadastrada(s)</p>
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

      <div className="max-w-4xl mx-auto px-6 pb-8 space-y-5">
        {nova && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Nova Conta Bancária</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Nome</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Banco</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Saldo inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center col-span-2">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center col-span-2">Nenhuma conta bancária cadastrada.</p>
          ) : (
            lista.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{c.nome}</p>
                  <p className="text-xs text-slate-400">{c.banco || "—"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
