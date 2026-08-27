"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

type Rubrica = {
  id: number;
  codigo: string;
  nome: string;
  tipo: "PROVENTO" | "DESCONTO";
  valor_fixo: string;
  is_ativo: boolean;
};

export default function RubricasPage() {
  const [lista, setLista] = useState<Rubrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"PROVENTO" | "DESCONTO">("DESCONTO");
  const [valorFixo, setValorFixo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dp/rubricas");
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
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
    if (!codigo || !nome || !valorFixo) {
      setErro("Preencha código, nome e valor.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/rubricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nome, tipo, valorFixo: Number(valorFixo) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cadastrar rubrica");
      setNova(false);
      setCodigo("");
      setNome("");
      setValorFixo("");
      setTipo("DESCONTO");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao cadastrar rubrica.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Departamento Pessoal</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Rubricas</h1>
            <p className="text-indigo-100 text-sm mt-1">Proventos e descontos fixos da folha</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dp"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button
              onClick={() => setNova(!nova)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              <Plus className="h-4 w-4" /> Nova Rubrica
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8 space-y-5">
        {nova && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Cadastrar Rubrica</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Código</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="ex: VT"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Nome</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="ex: Vale-transporte"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Tipo</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "PROVENTO" | "DESCONTO")}
                >
                  <option value="DESCONTO">Desconto</option>
                  <option value="PROVENTO">Provento</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Valor fixo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={valorFixo}
                  onChange={(e) => setValorFixo(e.target.value)}
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
            <Tag className="h-4 w-4 text-indigo-500" /> Rubricas Cadastradas
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma rubrica cadastrada ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Código</th>
                  <th className="pb-2">Nome</th>
                  <th className="pb-2 text-center">Tipo</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-mono text-xs text-slate-500">{r.codigo}</td>
                    <td className="py-2.5 font-medium text-slate-800">{r.nome}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          r.tipo === "PROVENTO" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">
                      R$ {Number(r.valor_fixo).toFixed(2)}
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
