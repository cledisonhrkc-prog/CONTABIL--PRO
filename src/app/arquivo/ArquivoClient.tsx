"use client";

import { useEffect, useState } from "react";

type Linha = { cnpj: string; nome: string; mes: string; qtd: string; total: string };

const fmt = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ArquivoClient() {
  const [dados, setDados] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/arquivo")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setDados(d.arquivo || []);
        else setErro(d.error || "Erro ao carregar");
      })
      .catch((e) => setErro(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const clientes: Record<string, { nome: string; meses: Linha[] }> = {};
  for (const l of dados) {
    if (!clientes[l.cnpj]) clientes[l.cnpj] = { nome: l.nome, meses: [] };
    clientes[l.cnpj].meses.push(l);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Arquivo de Clientes</h1>
      <p className="text-sm text-slate-500 mb-4">Notas arquivadas por cliente e competencia (mes).</p>

      {loading && <p className="text-slate-500">Carregando...</p>}
      {erro && <p className="text-red-600">{erro}</p>}
      {!loading && !erro && Object.keys(clientes).length === 0 && (
        <p className="text-slate-500">Nenhuma nota arquivada ainda.</p>
      )}

      <div className="space-y-6">
        {Object.entries(clientes).map(([cnpj, c]) => (
          <div key={cnpj} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-3">
              <div className="font-bold">{c.nome}</div>
              <div className="text-xs text-slate-300">CNPJ {cnpj}</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Competencia</th>
                  <th className="px-4 py-2 text-right">Notas</th>
                  <th className="px-4 py-2 text-right">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {c.meses.map((m, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{m.mes}</td>
                    <td className="px-4 py-2 text-right">{m.qtd}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(Number(m.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
