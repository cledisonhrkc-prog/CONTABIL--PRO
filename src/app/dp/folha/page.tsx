"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Play,
  Layers,
  Download,
  Filter,
  ArrowLeft,
} from "lucide-react";

export const dynamic = "force-dynamic";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Vinculo {
  id: number;
  colaborador_id: number;
  nome_completo: string;
}

interface Holerite {
  id: number;
  colaborador_id: number;
  colaborador_nome?: string;
  competencia: string;
  salario_base: string;
  total_proventos: string;
  total_descontos: string;
  total_liquido: string;
  status: string;
}

export default function FolhaPage() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [holerites, setHolerites] = useState<Holerite[]>([]);
  const [filtroCompetencia, setFiltroCompetencia] = useState(mesAtual());
  const [colaboradorId, setColaboradorId] = useState("");
  const [competenciaProcessar, setCompetenciaProcessar] = useState(mesAtual());
  const [processando, setProcessando] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  function carregarHolerites() {
    setCarregando(true);
    fetch(`/api/dp/folha/holerites?competencia=${filtroCompetencia}`)
      .then((r) => r.json())
      .then((data) => setHolerites(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    fetch("/api/dp/vinculos-clt-lista")
      .then((r) => r.json())
      .then((data) => setVinculos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarHolerites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCompetencia]);

  async function processarIndividual() {
    setErro("");
    setMensagem("");
    if (!colaboradorId) {
      setErro("Selecione um colaborador.");
      return;
    }
    setProcessando(true);
    try {
      const res = await fetch("/api/dp/folha/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaboradorId: Number(colaboradorId), competencia: competenciaProcessar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao processar folha.");
      setMensagem(`Folha processada — líquido R$ ${Number(data.total_liquido).toFixed(2)}`);
      carregarHolerites();
    } catch (e: any) {
      setErro(e.message || "Erro ao processar folha.");
    } finally {
      setProcessando(false);
    }
  }

  async function processarLote() {
    setErro("");
    setMensagem("");
    setProcessandoLote(true);
    try {
      const res = await fetch("/api/dp/folha/processar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia: competenciaProcessar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao processar folha em lote.");
      setMensagem(`Folha em lote processada — ${Array.isArray(data) ? data.length : "?"} colaborador(es).`);
      carregarHolerites();
    } catch (e: any) {
      setErro(e.message || "Erro ao processar folha em lote.");
    } finally {
      setProcessandoLote(false);
    }
  }

  const totalLiquidoMes = holerites.reduce((s, h) => s + Number(h.total_liquido), 0);
  const totalProventosMes = holerites.reduce((s, h) => s + Number(h.total_proventos), 0);
  const totalDescontosMes = holerites.reduce((s, h) => s + Number(h.total_descontos), 0);

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      {/* Header com gradiente — mesmo padrão de Financeiro/DP */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Departamento Pessoal</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Folha de Pagamento</h1>
          </div>
          <Link
            href="/dp"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8 space-y-5">
        {/* Cards de resumo — fundo colorido cheio, mesmo padrão de hoje */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Total Proventos</p>
            <p className="text-2xl font-bold mt-1">R$ {totalProventosMes.toFixed(2)}</p>
            <p className="text-xs mt-1 opacity-80">{holerites.length} holerite(s) na competência</p>
          </div>
          <div className="p-5 rounded-2xl shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Total Descontos</p>
            <p className="text-2xl font-bold mt-1">R$ {totalDescontosMes.toFixed(2)}</p>
          </div>
          <div className="p-5 rounded-2xl shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Total Líquido</p>
            <p className="text-2xl font-bold mt-1">R$ {totalLiquidoMes.toFixed(2)}</p>
          </div>
        </div>

        {/* Processar folha */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Play className="h-4 w-4 text-indigo-500" /> Processar Folha
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50"
              value={colaboradorId}
              onChange={(e) => setColaboradorId(e.target.value)}
            >
              <option value="">Selecione o colaborador...</option>
              {vinculos.map((v) => (
                <option key={v.colaborador_id} value={v.colaborador_id}>
                  {v.nome_completo}
                </option>
              ))}
            </select>
            <input
              type="month"
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50"
              value={competenciaProcessar}
              onChange={(e) => setCompetenciaProcessar(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={processarIndividual}
                disabled={processando}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> {processando ? "..." : "Individual"}
              </button>
              <button
                onClick={processarLote}
                disabled={processandoLote}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                <Layers className="h-4 w-4" /> {processandoLote ? "..." : "Lote"}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Pra hora extra, adicional noturno, afastamento ou licença-maternidade, use{" "}
            <Link href="/dp/folha-avancada" className="text-indigo-600 hover:underline">
              Folha — Eventos Especiais
            </Link>
            .
          </p>
          {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
          {mensagem && <p className="text-sm text-emerald-700 mt-2">{mensagem}</p>}
        </div>

        {/* Lista de holerites */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" /> Holerites
            </h2>
            <input
              type="month"
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50"
              value={filtroCompetencia}
              onChange={(e) => setFiltroCompetencia(e.target.value)}
            />
          </div>
          {carregando ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : holerites.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhum holerite nessa competência.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Colaborador</th>
                  <th className="pb-2 text-right">Proventos</th>
                  <th className="pb-2 text-right">Descontos</th>
                  <th className="pb-2 text-right">Líquido</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {holerites.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">
                      {h.colaborador_nome || `Colaborador #${h.colaborador_id}`}
                    </td>
                    <td className="py-2.5 text-right text-emerald-600">
                      R$ {Number(h.total_proventos).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right text-red-600">R$ {Number(h.total_descontos).toFixed(2)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">
                      R$ {Number(h.total_liquido).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                        {h.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <a
                        href={`/api/dp/pdf?tipo=holerite&id=${h.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </a>
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
