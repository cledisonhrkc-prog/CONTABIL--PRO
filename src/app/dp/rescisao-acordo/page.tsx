"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface Vinculo {
  id: number;
  colaborador_id: number;
  nome_completo: string;
  salario_base: string;
}

export default function RescisaoAcordoPage() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [vinculoId, setVinculoId] = useState("");
  const [dataRescisao, setDataRescisao] = useState("");
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
    setErro("");
    setResultado(null);
    if (!vinculoId || !dataRescisao) {
      setErro("Selecione o colaborador e a data da rescisão.");
      return;
    }
    setProcessando(true);
    try {
      // ATENÇÃO: formato do corpo assumido — a rota /api/dp/rescisao já
      // existia antes de hoje, nunca vi o código dela, só a lógica
      // interna de cálculo. Se der erro de campo, pode precisar ajustar
      // aqui pro formato real que a rota espera.
      const res = await fetch("/api/dp/rescisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vinculoId: Number(vinculoId),
          dataRescisao,
          motivo: "ACORDO",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao calcular rescisão.");
      setResultado(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao calcular rescisão.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rescisão por Acordo Mútuo</h1>
          <p className="text-sm text-slate-500">Art. 484-A CLT — aviso pela metade, multa FGTS de 20%</p>
        </div>
        <Link href="/dp" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Essa tela assume o formato de dados de uma rota que já existia antes de hoje. Se der erro ao
          processar, pode ser necessário ajustar o formato — a lógica de cálculo (testada hoje) está certa,
          mas a conexão com a rota pode precisar de ajuste fino.
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="text-sm text-slate-500 block mb-1">Colaborador</label>
          <select
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            value={vinculoId}
            onChange={(e) => setVinculoId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {vinculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome_completo} — R$ {Number(v.salario_base).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-500 block mb-1">Data da rescisão</label>
          <input
            type="date"
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            value={dataRescisao}
            onChange={(e) => setDataRescisao(e.target.value)}
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          onClick={processar}
          disabled={processando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {processando ? "Calculando..." : "Calcular Rescisão por Acordo"}
        </button>
      </div>

      {resultado && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Resultado</h2>
          <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-auto">{JSON.stringify(resultado, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
