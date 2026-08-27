"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";

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

export default function FolhaAvancadaPage() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [competencia, setCompetencia] = useState(mesAtual());
  const [horaExtra50Horas, setHoraExtra50Horas] = useState(0);
  const [horaExtra100Horas, setHoraExtra100Horas] = useState(0);
  const [horasNoturnas, setHorasNoturnas] = useState(0);
  const [diasAfastamentoDoenca, setDiasAfastamentoDoenca] = useState(0);
  const [licencaMaternidade, setLicencaMaternidade] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/dp/vinculos-clt-lista")
      .then((r) => r.json())
      .then((data) => setVinculos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function processar() {
    if (!colaboradorId) {
      setErro("Selecione um colaborador.");
      return;
    }
    setProcessando(true);
    setErro("");
    setResultado(null);
    try {
      const res = await fetch("/api/dp/folha/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: Number(colaboradorId),
          competencia,
          horaExtra50Horas: horaExtra50Horas || undefined,
          horaExtra100Horas: horaExtra100Horas || undefined,
          horasNoturnas: horasNoturnas || undefined,
          diasAfastamentoDoenca: diasAfastamentoDoenca || undefined,
          licencaMaternidade: licencaMaternidade || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao processar folha.");
      setResultado(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao processar folha.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Processar Folha — Eventos Especiais</h1>
          <p className="text-sm text-slate-500">Hora extra, adicional noturno, afastamento e licença-maternidade</p>
        </div>
        <Link href="/dp/folha" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Folha normal
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Colaborador</label>
            <select
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={colaboradorId}
              onChange={(e) => setColaboradorId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {vinculos.map((v) => (
                <option key={v.colaborador_id} value={v.colaborador_id}>
                  {v.nome_completo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Competência</label>
            <input
              type="month"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Hora extra 50% (h)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={horaExtra50Horas}
              onChange={(e) => setHoraExtra50Horas(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Hora extra 100% (h)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={horaExtra100Horas}
              onChange={(e) => setHoraExtra100Horas(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Horas noturnas (h)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={horasNoturnas}
              onChange={(e) => setHorasNoturnas(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-500 block mb-1">
            Dias de afastamento por auxílio-doença (0 se não houve)
          </label>
          <input
            type="number"
            min={0}
            max={30}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            value={diasAfastamentoDoenca}
            onChange={(e) => setDiasAfastamentoDoenca(Number(e.target.value))}
          />
          <p className="text-xs text-slate-400 mt-1">
            Empresa paga só até 15 dias — o resto é responsabilidade do INSS
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={licencaMaternidade}
            onChange={(e) => setLicencaMaternidade(e.target.checked)}
            className="w-4 h-4"
          />
          Esta competência é licença-maternidade (paga integral, empresa compensa com INSS depois)
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          onClick={processar}
          disabled={processando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {processando ? "Processando..." : "Processar folha"}
        </button>
      </div>

      {resultado && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Resultado</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Total proventos</p>
              <p className="font-semibold">R$ {Number(resultado.total_proventos).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400">Total descontos</p>
              <p className="font-semibold">R$ {Number(resultado.total_descontos).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400">Líquido</p>
              <p className="font-bold text-emerald-700">R$ {Number(resultado.total_liquido).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400">Status</p>
              <p className="font-semibold">{resultado.status}</p>
            </div>
          </div>
          {resultado.avisoIntegracao && (
            <p className="text-xs text-amber-700 mt-3">{resultado.avisoIntegracao}</p>
          )}
        </div>
      )}
    </div>
  );
}
