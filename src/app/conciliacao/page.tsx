"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Link from "next/link";

type Metodo = {
  codigo: string;
  nome: string;
  usado_por: string;
  valor: number;
  qtd?: number;
  qtd_itens?: number;
  observacao: string;
};

type Resp = {
  ok: boolean;
  empresa?: { nome: string; cnpj: string; regime: string };
  totais?: { qtd_notas: number; qtd_itens: number };
  metodos_faturamento?: Metodo[];
  cfop_itens_metodo_colab?: Array<{ operacao: string; cfop: string; qtd_itens: number; valor_soma_itens: number }>;
  cfop_notas_metodo_correto?: Array<{ operacao: string; cfop_principal: string; qtd_notas: number; valor_soma_notas: number }>;
  diagnostico?: { titulo: string; explicacao: string[] };
  error?: string;
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ConciliacaoPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch("/api/conciliacao");
      const j = await r.json();
      setData(j);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">🔍 Conciliação Fiscal ↔ Contábil (Colab)</h1>
            <p className="text-sm text-slate-500 mt-1">
              Compara os métodos de cálculo de faturamento entre sistemas. Útil para explicar divergências ao cliente.
            </p>
          </div>

          {loading && <div className="text-center py-16"><div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}

          {!loading && data?.error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">
              ❌ {data.error} — <Link href="/importar" className="underline">Importe XMLs primeiro</Link>
            </div>
          )}

          {!loading && data?.ok && data.totais && data.metodos_faturamento && (
            <>
              {/* KPIs de base */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs text-slate-500 font-medium">NOTAS FISCAIS ÚNICAS (autorizadas)</div>
                  <div className="text-3xl font-bold text-slate-800 mt-1">{data.totais.qtd_notas.toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-slate-500 mt-1">Cada NF conta 1 vez, independente de quantos itens tenha</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs text-slate-500 font-medium">ITENS DE NF (linhas de produto)</div>
                  <div className="text-3xl font-bold text-slate-800 mt-1">{data.totais.qtd_itens.toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-slate-500 mt-1">Média de {(data.totais.qtd_itens / Math.max(1, data.totais.qtd_notas)).toFixed(2)} itens por nota</div>
                </div>
              </div>

              {/* Diagnóstico */}
              {data.diagnostico && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 mb-6">
                  <h2 className="font-bold text-amber-900 mb-2">🎯 {data.diagnostico.titulo}</h2>
                  <ul className="space-y-1 text-sm text-amber-900">
                    {data.diagnostico.explicacao.map((l, i) => (
                      <li key={i}>• {l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 4 métodos de faturamento */}
              <h2 className="text-lg font-bold text-slate-800 mb-3">📊 4 Métodos de Faturamento (todos calculados do mesmo dado)</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {data.metodos_faturamento.map((m) => (
                  <div
                    key={m.codigo}
                    className={`border-2 rounded-lg p-4 ${
                      m.codigo === "M2"
                        ? "border-emerald-400 bg-emerald-50"
                        : m.codigo === "M4"
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            m.codigo === "M2" ? "bg-emerald-600 text-white" :
                            m.codigo === "M4" ? "bg-red-600 text-white" :
                            "bg-slate-500 text-white"
                          }`}>{m.codigo}</span>
                          <h3 className="font-bold text-slate-800 text-sm">{m.nome}</h3>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Usado por: {m.usado_por}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-slate-800">R$ {fmt(m.valor)}</div>
                        <div className="text-xs text-slate-500">
                          {m.qtd_itens ? `${m.qtd_itens.toLocaleString("pt-BR")} itens` : m.qtd ? `${m.qtd.toLocaleString("pt-BR")} notas` : ""}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{m.observacao}</p>
                  </div>
                ))}
              </div>

              {/* CFOP - método incorreto (Colab) vs correto */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <h3 className="font-bold text-red-900 mb-1">❌ CFOP por ITEM (método do Colab)</h3>
                  <p className="text-xs text-red-800 mb-3">
                    Cada linha de item aparece — se uma NF tem 3 medicamentos, os 3 CFOPs entram. Rótulo &quot;Qtd. Notas&quot; é ENGANOSO.
                  </p>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1">Op.</th>
                          <th className="text-left px-2 py-1">CFOP</th>
                          <th className="text-right px-2 py-1">Itens</th>
                          <th className="text-right px-2 py-1">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cfop_itens_metodo_colab?.slice(0, 20).map((r, i) => (
                          <tr key={i} className={i % 2 ? "bg-red-50" : "bg-white"}>
                            <td className="px-2 py-1">{r.operacao}</td>
                            <td className="px-2 py-1 font-mono">{r.cfop}</td>
                            <td className="text-right px-2 py-1">{r.qtd_itens}</td>
                            <td className="text-right px-2 py-1">R$ {fmt(r.valor_soma_itens)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-4">
                  <h3 className="font-bold text-emerald-900 mb-1">✅ CFOP por NOTA (método correto)</h3>
                  <p className="text-xs text-emerald-800 mb-3">
                    Cada NF entra 1 vez, com o CFOP predominante (o de maior valor entre os itens). Este é o número que bate com o faturamento.
                  </p>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-emerald-100 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1">Op.</th>
                          <th className="text-left px-2 py-1">CFOP princ.</th>
                          <th className="text-right px-2 py-1">Notas</th>
                          <th className="text-right px-2 py-1">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cfop_notas_metodo_correto?.slice(0, 20).map((r, i) => (
                          <tr key={i} className={i % 2 ? "bg-emerald-50" : "bg-white"}>
                            <td className="px-2 py-1">{r.operacao}</td>
                            <td className="px-2 py-1 font-mono">{r.cfop_principal}</td>
                            <td className="text-right px-2 py-1">{r.qtd_notas}</td>
                            <td className="text-right px-2 py-1">R$ {fmt(r.valor_soma_notas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Como explicar ao cliente */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h2 className="font-bold text-slate-800 mb-2">💬 Como explicar ao cliente quando ele perguntar</h2>
                <div className="text-sm text-slate-700 space-y-2">
                  <p>
                    <b>1. &quot;Por que o outro sistema mostra R$ 57k em CFOP mas R$ 37k em faturamento?&quot;</b><br/>
                    → O outro sistema soma <b>itens</b> na tabela de CFOP, mas soma <b>notas</b> no cabeçalho. Cada NF tem em média {data.totais && (data.totais.qtd_itens/Math.max(1,data.totais.qtd_notas)).toFixed(1)} itens, então o CFOP conta cada nota várias vezes. É <b>rotulagem confusa</b>, não erro de conta.
                  </p>
                  <p>
                    <b>2. &quot;Por que o CONTÁBIL PRO mostra faturamento menor?&quot;</b><br/>
                    → Este sistema <b>filtra notas canceladas (cStat=101) e denegadas (cStat=110)</b>, que o outro sistema conta como venda válida. Além disso, deduz o ICMS-ST (imposto já retido, não é receita).
                  </p>
                  <p>
                    <b>3. &quot;Qual valor eu declaro no PGDAS?&quot;</b><br/>
                    → O do método <span className="font-mono bg-emerald-100 px-1 rounded">M2</span> ({data.metodos_faturamento && `R$ ${fmt(data.metodos_faturamento[1].valor)}`}). É o valor líquido de ST, sem canceladas, base correta para calcular o DAS.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
