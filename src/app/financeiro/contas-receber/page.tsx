/**
 * Contas a Receber — lista completa com filtros e baixa
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, statusLabel, statusColor } from "@/utils/format";

interface Conta {
  id: number;
  participante: string;
  descricao?: string;
  emissao: string;
  vencimento: string;
  valor: string;
  valorPago: string;
  status: string;
}

export default function ContasReceberPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("ABERTO,PARCIAL");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    load();
  }, [filtroStatus]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (busca) params.set("busca", busca);
      const res = await fetch(`/api/financeiro/contas-receber?${params}`);
      const data = await res.json();
      setContas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function saldo(c: Conta) {
    return Number(c.valor) - Number(c.valorPago || 0);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas a Receber</h1>
          <p className="text-sm text-gray-500">Títulos de clientes</p>
        </div>
        <Link
          href="/financeiro"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Voltar ao Dashboard
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="ABERTO,PARCIAL">Em aberto</option>
          <option value="PAGO">Pagos</option>
          <option value="ABERTO,PARCIAL,PAGO">Todos</option>
          <option value="CANCELADO">Cancelados</option>
        </select>
        <input
          type="text"
          placeholder="Buscar cliente ou descrição..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
        >
          Filtrar
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Carregando...
                  </td>
                </tr>
              ) : contas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Nenhuma conta encontrada
                  </td>
                </tr>
              ) : (
                contas.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.participante}</td>
                    <td className="px-4 py-3 text-gray-500">{c.descricao || "—"}</td>
                    <td className="px-4 py-3">{formatDate(c.emissao)}</td>
                    <td className="px-4 py-3">{formatDate(c.vencimento)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.valor)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(saldo(c))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(c.status === "ABERTO" || c.status === "PARCIAL") && (
                        <Link
                          href={`/financeiro/contas-receber/${c.id}/baixa`}
                          className="text-blue-600 hover:underline text-xs font-medium"
                        >
                          Baixar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
