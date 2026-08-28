"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Tags } from "lucide-react";

export const dynamic = "force-dynamic";

interface Categoria {
  id: number;
  nome: string;
  tipo: "ENTRADA" | "SAIDA";
}

export default function CategoriasPage() {
  const [lista, setLista] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/categorias");
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
      setErro("Informe o nome da categoria.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/financeiro/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cadastrar categoria.");
      setNova(false);
      setNome("");
      setTipo("SAIDA");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao cadastrar categoria.");
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
            <h1 className="text-white text-2xl font-bold mt-0.5">Categorias</h1>
            <p className="text-indigo-100 text-sm mt-1">Classificação de entradas e saídas</p>
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
              <Plus className="h-4 w-4" /> Nova Categoria
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8 space-y-5">
        {nova && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Nova Categoria</h2>
            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-sm text-slate-500 block mb-1">Tipo</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "ENTRADA" | "SAIDA")}
                >
                  <option value="SAIDA">Saída</option>
                  <option value="ENTRADA">Entrada</option>
                </select>
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
            <Tags className="h-4 w-4 text-indigo-500" /> Categorias Cadastradas
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma categoria cadastrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Nome</th>
                  <th className="pb-2 text-center">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{c.nome}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          c.tipo === "ENTRADA" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {c.tipo}
                      </span>
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
