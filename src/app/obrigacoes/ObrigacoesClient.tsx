"use client";

import { useEffect, useState } from "react";

type Obrigacao = {
  id: number;
  empresa_id: number;
  tipo: string;
  descricao: string | null;
  periodo: string | null;
  data_vencimento: string;
  status: string;
  data_entrega: string | null;
  observacao: string | null;
};

const TIPOS_COMUNS = ["DAS", "DCTF", "DEFIS", "SPED FISCAL", "EFD-CONTRIBUICOES", "ECF", "GIA", "OUTRA"];

export default function ObrigacoesClient({ empresaId }: { empresaId: number }) {
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({
    tipo: "DAS",
    descricao: "",
    periodo: "",
    data_vencimento: "",
    observacao: "",
  });

  async function carregar() {
    setCarregando(true);
    const obRes = await fetch(`/api/obrigacoes?empresa_id=${empresaId}`);
    const ob = await obRes.json();
    setObrigacoes(ob.obrigacoes ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cadastrar() {
    if (!form.data_vencimento) return;
    await fetch("/api/obrigacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa_id: empresaId, ...form }),
    });
    setForm({ tipo: "DAS", descricao: "", periodo: "", data_vencimento: "", observacao: "" });
    carregar();
  }

  async function marcarEntregue(id: number) {
    await fetch("/api/obrigacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "ENTREGUE" }),
    });
    carregar();
  }

  function statusCor(o: Obrigacao) {
    if (o.status === "ENTREGUE") return "bg-green-100 text-green-700";
    const hoje = new Date().toISOString().slice(0, 10);
    if (o.data_vencimento < hoje) return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  }

  function statusLabel(o: Obrigacao) {
    if (o.status === "ENTREGUE") return "Entregue";
    const hoje = new Date().toISOString().slice(0, 10);
    if (o.data_vencimento < hoje) return "Atrasada";
    return "Pendente";
  }

  return (
    <>
      <section className="mb-6 bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="font-semibold text-slate-700 mb-3 text-sm">Nova obrigação</h2>
        <div className="grid md:grid-cols-5 gap-3">
          <select
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {TIPOS_COMUNS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            placeholder="Período (ex: 2026-07)"
            value={form.periodo}
            onChange={(e) => setForm({ ...form, periodo: e.target.value })}
          />
          <input
            type="date"
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            value={form.data_vencimento}
            onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
          />
          <input
            className="border border-slate-300 rounded px-2 py-1.5 text-sm md:col-span-2"
            placeholder="Observação (opcional)"
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          />
        </div>
        <button
          onClick={cadastrar}
          disabled={!form.data_vencimento}
          className="mt-3 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-40"
        >
          + Adicionar
        </button>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Período</th>
              <th className="px-3 py-2 text-left">Vencimento</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Observação</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {obrigacoes.map((o) => (
              <tr key={o.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium">{o.tipo}</td>
                <td className="px-3 py-2">{o.periodo || "-"}</td>
                <td className="px-3 py-2">{o.data_vencimento}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCor(o)}`}>
                    {statusLabel(o)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{o.observacao || "-"}</td>
                <td className="px-3 py-2 text-right">
                  {o.status !== "ENTREGUE" && (
                    <button
                      onClick={() => marcarEntregue(o.id)}
                      className="text-xs text-indigo-600 underline"
                    >
                      Marcar entregue
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!carregando && obrigacoes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  Nenhuma obrigação cadastrada ainda.
                </td>
              </tr>
            )}
            {carregando && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
