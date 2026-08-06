"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Link from "next/link";

type Regime = {
  regime: string;
  nome: string;
  faturamento_anual: number;
  aliquota_efetiva: number;
  imposto_anual: number;
  detalhes: string[];
  observacoes: string[];
  incompatibilidades: string[];
  fonte_legal: string;
};

type Resp = {
  ok: boolean;
  empresa?: { nome: string; cnpj: string; regime_atual: string; segmento: string | null };
  periodo?: { inicio: string; fim: string; meses: number; faturamento_periodo: number; faturamento_anualizado: number };
  regimes?: Regime[];
  melhor?: Regime | null;
  aviso_juridico?: string;
  error?: string;
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ComparativoPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [margem, setMargem] = useState(10);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const r = await fetch(`/api/comparativo?margem=${margem}`);
    const j = await r.json();
    setData(j);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const corRegime = (r: string) => {
    if (r === "SIMPLES") return "border-emerald-300 bg-emerald-50";
    if (r === "LUCRO_PRESUMIDO") return "border-blue-300 bg-blue-50";
    if (r === "LUCRO_REAL") return "border-indigo-300 bg-indigo-50";
    if (r === "REFORMA_2027") return "border-amber-300 bg-amber-50";
    if (r === "REFORMA_2033") return "border-red-300 bg-red-50";
    return "border-slate-200 bg-white";
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">🏛️ Comparativo de Regimes Tributários</h1>
            <p className="text-sm text-slate-500 mt-1">
              Análise DETERMINÍSTICA (sem alucinação de IA) baseada nas notas realmente processadas.
            </p>
          </div>

          {loading && (
            <div className="text-center py-16">
              <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && data?.error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">
              ❌ {data.error} — <Link href="/importar" className="underline">Importe XMLs primeiro</Link>
            </div>
          )}

          {!loading && data?.ok && data.empresa && data.periodo && data.regimes && (
            <>
              {/* Contexto */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
                <h2 className="font-semibold text-slate-800 mb-3">📊 Dados-base do comparativo</h2>
                <div className="grid md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Empresa</div>
                    <div className="font-medium">{data.empresa.nome}</div>
                    <div className="text-xs text-slate-500">CNPJ {data.empresa.cnpj}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Regime atual</div>
                    <div className="font-medium">{data.empresa.regime_atual}</div>
                    <div className="text-xs text-slate-500">Segmento: {data.empresa.segmento ?? "COMERCIO"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Período observado</div>
                    <div className="font-medium">{data.periodo.inicio} a {data.periodo.fim}</div>
                    <div className="text-xs text-slate-500">{data.periodo.meses} mês(es)</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Faturamento anualizado</div>
                    <div className="font-bold text-lg text-slate-800">R$ {fmt(data.periodo.faturamento_anualizado)}</div>
                    <div className="text-xs text-slate-500">período × 12/meses</div>
                  </div>
                </div>

                <div className="mt-4 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Margem operacional real (%) — necessária para o Lucro Real
                    </label>
                    <input
                      type="number"
                      value={margem}
                      onChange={(e) => setMargem(Number(e.target.value))}
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={carregar}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium"
                  >
                    Recalcular
                  </button>
                </div>
              </div>

              {/* Melhor regime */}
              {data.melhor && (
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-5 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <div className="text-xs text-emerald-700 font-medium">MELHOR REGIME (dentro do calculável)</div>
                      <div className="text-xl font-bold text-emerald-900">{data.melhor.nome}</div>
                      <div className="text-sm text-emerald-800">
                        Imposto anual estimado: <b>R$ {fmt(data.melhor.imposto_anual)}</b> ({(data.melhor.aliquota_efetiva * 100).toFixed(4)}% do faturamento)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cards de cada regime */}
              <div className="grid md:grid-cols-2 gap-4">
                {data.regimes.map((r) => (
                  <div key={r.regime} className={`rounded-lg border-2 p-4 ${corRegime(r.regime)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-800">{r.nome}</h3>
                        <div className="text-xs text-slate-500">{r.fonte_legal}</div>
                      </div>
                      {r.imposto_anual >= 0 && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-800">R$ {fmt(r.imposto_anual)}</div>
                          <div className="text-xs text-slate-500">{(r.aliquota_efetiva * 100).toFixed(4)}%</div>
                        </div>
                      )}
                    </div>

                    {r.incompatibilidades.length > 0 && (
                      <div className="bg-red-100 border border-red-300 rounded p-2 mb-2">
                        {r.incompatibilidades.map((i, idx) => (
                          <div key={idx} className="text-xs text-red-800">❌ {i}</div>
                        ))}
                      </div>
                    )}

                    {r.imposto_anual === -2 && (
                      <div className="bg-amber-100 border border-amber-300 rounded p-2 mb-2 text-xs text-amber-800">
                        ⚠️ Precisa da margem operacional pra calcular. Informe acima e recalcule.
                      </div>
                    )}

                    {r.detalhes.length > 0 && (
                      <details className="mb-2">
                        <summary className="text-xs font-medium text-slate-700 cursor-pointer hover:text-slate-900">
                          🧮 Ver memória de cálculo
                        </summary>
                        <ul className="text-xs text-slate-600 mt-1 space-y-0.5 pl-4">
                          {r.detalhes.map((d, idx) => (
                            <li key={idx}>• {d}</li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {r.observacoes.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {r.observacoes.map((o, idx) => (
                          <div key={idx} className="text-xs text-slate-700 bg-white/50 rounded px-2 py-1">
                            {o}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Aviso jurídico */}
              {data.aviso_juridico && (
                <div className="mt-6 bg-slate-100 border-l-4 border-slate-500 rounded p-4 text-xs text-slate-700">
                  <b>⚖️ Aviso legal:</b> {data.aviso_juridico}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
