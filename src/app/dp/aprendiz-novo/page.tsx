"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AprendizNovoPage() {
  const [cpf, setCpf] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cargo, setCargo] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function salvar() {
    setErro("");
    setMensagem("");
    if (!cpf || !nomeCompleto || !dataAdmissao || !salarioBase) {
      setErro("Preencha CPF, nome, data de admissão e salário base.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/dp/aprendiz-novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, nomeCompleto, cargo, dataAdmissao, salarioBase: Number(salarioBase) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cadastrar.");
      setMensagem(`Aprendiz cadastrado! FGTS de 2% será aplicado automaticamente ao processar a folha.`);
      setCpf("");
      setNomeCompleto("");
      setCargo("");
      setDataAdmissao("");
      setSalarioBase("");
    } catch (e: any) {
      setErro(e.message || "Erro ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Aprendiz</h1>
          <p className="text-sm text-slate-500">FGTS reduzido a 2% (Art. 15, §7º, Lei 8.036/90)</p>
        </div>
        <Link href="/dp" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">CPF</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="Só números ou com pontuação"
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Nome completo</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Cargo</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="ex: Aprendiz Administrativo"
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Data de admissão</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-500 block mb-1">Salário base (R$)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            value={salarioBase}
            onChange={(e) => setSalarioBase(e.target.value)}
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {mensagem && <p className="text-sm text-emerald-700">{mensagem}</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {salvando ? "Salvando..." : "Cadastrar Aprendiz"}
        </button>
      </div>
    </div>
  );
}
