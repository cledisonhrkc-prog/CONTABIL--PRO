/**
 * Dashboard Financeiro Completo
 * Contábil Pro — Módulo Financeiro
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  statusLabel,
  statusColor,
} from "@/utils/format";

// Ajuste os imports de dados conforme sua API/auth
// Exemplo: useEmpresa(), fetch com empresaId etc.

interface Resumo {
  receber: { total: number; vencido: number; aVencer: number; quantidade: number };
  pagar: { total: number; vencido: number; aVencer: number; quantidade: number };
}

interface SaldoConta {
  id: number;
  nome: string;
  saldo: number;
  tipo: string;
  cor: string;
}

interface FluxoMes {
  mes: string;
  entradasConfirmadas: number;
  saidasConfirmadas: number;
  entradasProjetadas: number;
  saidasProjetadas: number;
  saldoInicial: number;
  saldoFinal: number;
}

export default function FinanceiroDashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [saldos, setSaldos] = useState<{ total: number; porConta: SaldoConta[] } | null>(null);
  const [fluxo, setFluxo] = useState<FluxoMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJson(url: string) {
      const r = await fetch(url);
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        throw new Error(data?.error || `Erro ao carregar ${url} (${r.status})`);
      }
      return data;
    }

    async function load() {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetchJson("/api/financeiro/resumo"),
          fetchJson("/api/financeiro/saldos"),
          fetchJson("/api/financeiro/fluxo-caixa?meses=6"),
        ]);
        setResumo(r1);
        setSaldos(r2);
        setFluxo(r3);
      } catch (e: any) {
        console.error(e);
        setErro(e.message || "Erro ao carregar dados financeiros.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md text-center bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-amber-800 font-medium mb-2">Não foi possível carregar o financeiro</p>
          <p className="text-sm text-amber-700 mb-4">{erro}</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            Voltar e selecionar empresa
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">Visão completa de caixa, contas e fluxo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/lancamentos/novo"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Lançamento
          </Link>
          <Link
            href="/financeiro/transferencias"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Transferência
          </Link>
          <a href="/api/financeiro/relatorios/fluxo-caixa/pdf" className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Exportar PDF</a>
          <a href="/api/financeiro/relatorios/fluxo-caixa/excel" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Exportar Excel</a>
          <Link
            href="/financeiro/contas-bancarias"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Contas Bancárias
          </Link>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          titulo="Saldo Bancário"
          valor={formatCurrency(saldos?.total || 0)}
          subtitulo={`${saldos?.porConta?.length || 0} conta(s)`}
          cor="blue"
          href="/financeiro/contas-bancarias"
        />
        <Card
          titulo="A Receber"
          valor={formatCurrency(resumo?.receber.total || 0)}
          subtitulo={
            resumo?.receber.vencido
              ? `Vencido: ${formatCurrency(resumo.receber.vencido)}`
              : `${resumo?.receber.quantidade || 0} títulos`
          }
          cor="green"
          href="/financeiro/contas-receber"
          alerta={!!resumo?.receber.vencido}
        />
        <Card
          titulo="A Pagar"
          valor={formatCurrency(resumo?.pagar.total || 0)}
          subtitulo={
            resumo?.pagar.vencido
              ? `Vencido: ${formatCurrency(resumo.pagar.vencido)}`
              : `${resumo?.pagar.quantidade || 0} títulos`
          }
          cor="red"
          href="/financeiro/contas-pagar"
          alerta={!!resumo?.pagar.vencido}
        />
        <Card
          titulo="Resultado Projetado (mês)"
          valor={formatCurrency(
            (fluxo[0]?.entradasConfirmadas || 0) +
              (fluxo[0]?.entradasProjetadas || 0) -
              (fluxo[0]?.saidasConfirmadas || 0) -
              (fluxo[0]?.saidasProjetadas || 0)
          )}
          subtitulo="Entradas − Saídas"
          cor="purple"
          href="/financeiro/fluxo-caixa"
        />
      </div>

      {/* Saldos por conta */}
      {saldos && saldos.porConta.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold mb-4">Saldos por Conta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saldos.porConta.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.cor }}
                  />
                  <div>
                    <p className="font-medium text-sm">{c.nome}</p>
                    <p className="text-xs text-gray-500">{c.tipo}</p>
                  </div>
                </div>
                <p
                  className={`font-semibold text-sm ${
                    c.saldo >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(c.saldo)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fluxo de Caixa resumido */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Fluxo de Caixa (6 meses)</h2>
          <Link
            href="/financeiro/fluxo-caixa"
            className="text-sm text-blue-600 hover:underline"
          >
            Ver completo →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Mês</th>
                <th className="pb-2 pr-4 text-right">Entradas</th>
                <th className="pb-2 pr-4 text-right">Saídas</th>
                <th className="pb-2 pr-4 text-right">Projetado</th>
                <th className="pb-2 text-right">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {fluxo.map((m, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2.5 pr-4 font-medium">{m.mes}</td>
                  <td className="py-2.5 pr-4 text-right text-green-600">
                    {formatCurrency(m.entradasConfirmadas + m.entradasProjetadas)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-red-600">
                    {formatCurrency(m.saidasConfirmadas + m.saidasProjetadas)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-500">
                    {formatCurrency(
                      m.entradasProjetadas - m.saidasProjetadas
                    )}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      m.saldoFinal >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {formatCurrency(m.saldoFinal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Atalho href="/financeiro/contas-receber" label="Contas a Receber" />
        <Atalho href="/financeiro/contas-pagar" label="Contas a Pagar" />
        <Atalho href="/financeiro/lancamentos" label="Lançamentos" />
        <Atalho href="/financeiro/conciliacao" label="Conciliação" />
        <Atalho href="/financeiro/categorias" label="Categorias" />
        <Atalho href="/financeiro/contas-bancarias" label="Contas Bancárias" />
        <Atalho href="/financeiro/transferencias" label="Transferências" />
        <Atalho href="/financeiro/fluxo-caixa" label="Fluxo de Caixa" />
      </div>
    </div>
  );
}

function Card({
  titulo,
  valor,
  subtitulo,
  cor,
  href,
  alerta,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
  cor: "blue" | "green" | "red" | "purple";
  href: string;
  alerta?: boolean;
}) {
  const cores = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    purple: "border-purple-200 bg-purple-50",
  };
  const text = {
    blue: "text-blue-700",
    green: "text-green-700",
    red: "text-red-700",
    purple: "text-purple-700",
  };

  return (
    <Link
      href={href}
      className={`block p-5 rounded-xl border ${cores[cor]} hover:shadow-md transition`}
    >
      <p className="text-sm font-medium text-gray-600">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${text[cor]}`}>{valor}</p>
      <p className={`text-xs mt-1 ${alerta ? "text-red-600 font-medium" : "text-gray-500"}`}>
        {subtitulo}
      </p>
    </Link>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block p-4 bg-white border border-gray-200 rounded-lg text-center text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition"
    >
      {label}
    </Link>
  );
}

