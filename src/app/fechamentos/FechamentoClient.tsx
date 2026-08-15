"use client";

import { useEffect, useState } from "react";

type Empresa = { id: number; nome: string; cnpj: string };

export default function FechamentoClient() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [carregando, setCarregando] = useState(true);
  const [preview, setPreview] = useState<{
    qtd_notas: number;
    receitas: number;
    despesas: number;
    saldo: number;
  } | null>(null);
  const [buscandoPreview, setBuscandoPreview] = useState(false);

  useEffect(() => {
    fetch("/api/minhas-empresas")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEmpresas(data.empresas ?? []);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  async function buscarPreview() {
    if (!empresaId || !mes) return;
    setBuscandoPreview(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/fechamento-mensal?empresa_id=${empresaId}&mes=${mes}`);
      const data = await res.json();
      if (data.ok) setPreview(data.dados.resumo);
    } catch {
      // silencioso — o preview é só um adiantamento visual
    }
    setBuscandoPreview(false);
  }

  useEffect(() => {
    if (empresaId && mes) buscarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, mes]);

  function baixarPdf() {
    if (!empresaId || !mes) return;
    window.open(`/api/fechamento-mensal/pdf?empresa_id=${empresaId}&mes=${mes}`, "_blank");
  }

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5 max-w-xl">
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
        <select
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          disabled={carregando}
        >
          <option value="">
            {carregando ? "Carregando..." : "Selecione um cliente..."}
          </option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome} — {e.cnpj}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-600 mb-1">Mês</label>
        <input
          type="month"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        />
      </div>

      {buscandoPreview && (
        <div className="text-xs text-slate-400 mb-4">Carregando prévia...</div>
      )}

      {preview && !buscandoPreview && (
        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Notas no mês</div>
            <div className="font-bold text-slate-800">{preview.qtd_notas}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Saldo</div>
            <div className={`font-bold ${preview.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(preview.saldo)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Receitas</div>
            <div className="font-bold text-emerald-700">{fmt(preview.receitas)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Despesas</div>
            <div className="font-bold text-red-700">{fmt(preview.despesas)}</div>
          </div>
        </div>
      )}

      <button
        onClick={baixarPdf}
        disabled={!empresaId || !mes}
        className="w-full bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded disabled:opacity-40"
      >
        📄 Baixar PDF do Fechamento
      </button>
    </section>
  );
}
