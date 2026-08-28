"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, LogOut, Download } from "lucide-react";

export const dynamic = "force-dynamic";

type VinculoCLT = { id: number; colaborador_nome: string };
type Rescisao = {
  id: number;
  colaborador_nome: string;
  motivo: string;
  data_rescisao: string;
  total_liquido: string;
  status: string;
};

const MOTIVOS = [
  { value: "SEM_JUSTA_CAUSA", label: "Sem Justa Causa" },
  { value: "COM_JUSTA_CAUSA", label: "Com Justa Causa" },
  { value: "PEDIDO_DEMISSAO", label: "Pedido de Demissão" },
  { value: "ACORDO", label: "Acordo Mútuo (Art. 484-A)" },
];

export default function RescisoesPage() {
  const [clts, setClts] = useState<VinculoCLT[]>([]);
  const [lista, setLista] = useState<Rescisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);
  const [vinculoId, setVinculoId] = useState("");
  const [motivo, setMotivo] = useState("SEM_JUSTA_CAUSA");
  const [dataRescisao, setDataRescisao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dp/rescisao");
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
    if (!vinculoId || !dataRescisao) {
      setErro("Selecione o colaborador e a data.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/rescisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinculoId: Number(vinculoId), motivo, dataRescisao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao calcular rescisão");
      setNova(false);
      setVinculoId("");
      setDataRescisao("");
      setMotivo("SEM_JUSTA_CAUSA");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao calcular rescisão.");
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
            <h1 className="text-white text-2xl font-bold mt-0.5">Rescisões</h1>
            <p className="text-indigo-100 text-sm mt-1">Cálculo de rescisão contratual</p>
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
              <Plus className="h-4 w-4" /> Nova Rescisão
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-8 space-y-5">
        {nova && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Calcular Rescisão</h2>
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
                <label className="text-sm text-slate-500 block mb-1">Motivo</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                >
                  {MOTIVOS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Data da rescisão</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50"
                  value={dataRescisao}
                  onChange={(e) => setDataRescisao(e.target.value)}
                />
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvando ? "Calculando..." : "Calcular Rescisão"}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <LogOut className="h-4 w-4 text-indigo-500" /> Rescisões Calculadas
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma rescisão calculada ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Colaborador</th>
                  <th className="pb-2">Motivo</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2 text-right">Líquido</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{r.colaborador_nome}</td>
                    <td className="py-2.5 text-slate-600">
                      {MOTIVOS.find((m) => m.value === r.motivo)?.label || r.motivo}
                    </td>
                    <td className="py-2.5 text-slate-600">{r.data_rescisao}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">
                      R$ {Number(r.total_liquido).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <a
                        href={`/api/dp/pdf?tipo=rescisao&id=${r.id}`}
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
