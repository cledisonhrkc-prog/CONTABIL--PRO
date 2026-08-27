"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

type VinculoCLT = { id: number; colaborador_nome: string };
type Decimo = {
  id: number;
  colaborador_nome: string;
  ano: number;
  parcela: number;
  total_bruto: string;
  total_liquido: string;
  status: string;
};

export default function DecimoTerceiroPage() {
  const [clts, setClts] = useState<VinculoCLT[]>([]);
  const [lista, setLista] = useState<Decimo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [vinculoId, setVinculoId] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [parcela, setParcela] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dp/decimo-terceiro");
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/dp/vinculos?tipoVinculo=CLT")
      .then((r) => r.json())
      .then((data) => setClts(Array.isArray(data) ? data : []))
      .catch(() => {});
    load();
  }, []);

  async function salvar() {
    if (!vinculoId || !ano || !parcela) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/decimo-terceiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinculoId: Number(vinculoId), ano: Number(ano), parcela: Number(parcela) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao calcular 13º");
      setNovo(false);
      setVinculoId("");
      setParcela("1");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao calcular 13º.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Departamento Pessoal</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">13º Salário</h1>
            <p className="text-indigo-100 text-sm mt-1">Cálculo de 1ª e 2ª parcela</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dp"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button
              onClick={() => setNovo(!novo)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              <Plus className="h-4 w-4" /> Calcular 13º
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-8 space-y-5">
        {novo && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Calcular Nova Parcela</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Colaborador</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={vinculoId}
                  onChange={(e) => setVinculoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {clts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.colaborador_nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Ano</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Parcela</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={parcela}
                  onChange={(e) => setParcela(e.target.value)}
                >
                  <option value="1">1ª parcela (sem desconto)</option>
                  <option value="2">2ª parcela (com INSS/IRRF sobre o total)</option>
                </select>
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvando ? "Calculando..." : "Calcular"}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Gift className="h-4 w-4 text-indigo-500" /> 13º Salário Calculado
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhum 13º calculado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Colaborador</th>
                  <th className="pb-2 text-center">Ano</th>
                  <th className="pb-2 text-center">Parcela</th>
                  <th className="pb-2 text-right">Bruto</th>
                  <th className="pb-2 text-right">Líquido</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{d.colaborador_nome}</td>
                    <td className="py-2.5 text-center">{d.ano}</td>
                    <td className="py-2.5 text-center">{d.parcela}ª</td>
                    <td className="py-2.5 text-right text-emerald-600">R$ {Number(d.total_bruto).toFixed(2)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">
                      R$ {Number(d.total_liquido).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                        {d.status}
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
