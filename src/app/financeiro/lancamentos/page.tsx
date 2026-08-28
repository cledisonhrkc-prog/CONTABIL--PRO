"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

interface ContaBancaria {
  id: number;
  nome: string;
}

interface Lancamento {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  data: string;
  valor: string;
  descricao: string;
  participante?: string;
}

export default function LancamentosPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [participante, setParticipante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/lancamentos");
      const dataRes = await res.json();
      setLista(Array.isArray(dataRes) ? dataRes : dataRes?.value || []);
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
    if (!data || !valor || !descricao || !contaBancariaId) {
      setErro("Preencha data, valor, descrição e conta bancária.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          data,
          valor: Number(valor),
          descricao,
          contaBancariaId: Number(contaBancariaId),
          participante: participante || undefined,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData?.error || "Erro ao lançar.");
      setNovo(false);
      setData("");
      setValor("");
      setDescricao("");
      setParticipante("");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao lançar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Lançamentos</h1>
            <p className="text-indigo-100 text-sm mt-1">Entradas e saídas manuais</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/financeiro"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button
              onClick={() => setNovo(!novo)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              <Plus className="h-4 w-4" /> Novo Lançamento
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-8 space-y-5">
        {novo && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Novo Lançamento</h2>
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="text-sm text-slate-500 block mb-1">Conta bancária</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={contaBancariaId}
                  onChange={(e) => setContaBancariaId(e.target.value)}
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
                <label className="text-sm text-slate-500 block mb-1">Data</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
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
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Descrição</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Participante (opcional)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                value={participante}
                onChange={(e) => setParticipante(e.target.value)}
              />
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Lançar"}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" /> Lançamentos
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhum lançamento cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="py-2.5 text-slate-600">{l.data}</td>
                    <td className="py-2.5 font-medium text-slate-800">{l.descricao}</td>
                    <td
                      className={`py-2.5 text-right font-bold ${
                        l.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {l.tipo === "ENTRADA" ? "+" : "-"}R$ {Number(l.valor).toFixed(2)}
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
