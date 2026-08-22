"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  statusLabel,
  statusColor,
} from "@/utils/format";
import { Plus, ArrowLeftRight, Landmark, ArrowRight } from "lucide-react";

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
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-slate-200 border-t-indigo-600" />
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

  const resultadoMes =
    (fluxo[0]?.entradasConfirmadas || 0) +
    (fluxo[0]?.entradasProjetadas || 0) -
    (fluxo[0]?.saidasConfirmadas || 0) -
    (fluxo[0]?.saidasProjetadas || 0);

  const posicaoLiquida = (resumo?.receber.total || 0) - (resumo?.pagar.total || 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto bg-white min-h-screen -m-6">
      {/* Header enxuto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Financeiro</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão de caixa, contas e fluxo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/lancamentos/novo"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" /> Lançamento
          </Link>
          <Link
            href="/financeiro/transferencias"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            <ArrowLeftRight className="h-4 w-4" /> Transferência
          </Link>
          <Link
            href="/financeiro/contas-bancarias"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            <Landmark className="h-4 w-4" /> Contas
          </Link>
        </div>
      </div>

      {/* Hero: o número que a pessoa veio ver — posição líquida, com contexto ao lado */}
      <div className="rounded-2xl border border-slate-200 p-6 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Posição líquida (a receber − a pagar)</p>
            <p
              className={`text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums ${
                posicaoLiquida >= 0 ? "text-slate-900" : "text-red-600"
              }`}
            >
              {formatCurrency(posicaoLiquida)}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Saldo em conta: <span className="tabular-nums font-medium text-slate-600">{formatCurrency(saldos?.total || 0)}</span>
              {" · "}
              {saldos?.porConta?.length || 0} conta(s) bancária(s)
            </p>
          </div>
          <div className="flex gap-6 sm:gap-8 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-8">
            <MiniStat
              label="A receber"
              value={formatCurrency(resumo?.receber.total || 0)}
              sub={resumo?.receber.vencido ? `${formatCurrency(resumo.receber.vencido)} vencido` : undefined}
              subTone="warn"
            />
            <MiniStat
              label="A pagar"
              value={formatCurrency(resumo?.pagar.total || 0)}
              sub={resumo?.pagar.vencido ? `${formatCurrency(resumo.pagar.vencido)} vencido` : undefined}
              subTone="warn"
            />
            <MiniStat
              label="Projetado (mês)"
              value={formatCurrency(resultadoMes)}
              sub={resultadoMes >= 0 ? "positivo" : "negativo"}
              subTone={resultadoMes >= 0 ? "good" : "bad"}
            />
          </div>
        </div>
      </div>

      {/* Exportar relatório — discreto, não compete com o hero */}
      <details className="group rounded-xl border border-slate-200 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900">
          Exportar relatório de fluxo de caixa
          <ArrowRight className="h-4 w-4 transition group-open:rotate-90" />
        </summary>
        <div className="px-5 pb-5 pt-1">
          <ExportadorFluxoCaixa />
        </div>
      </details>

      {/* Saldos por conta */}
      {saldos && saldos.porConta.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Saldos por conta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {saldos.porConta.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                  <div>
                    <p className="text-sm text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-400">{c.tipo}</p>
                  </div>
                </div>
                <p className={`text-sm font-medium tabular-nums ${c.saldo >= 0 ? "text-slate-800" : "text-red-600"}`}>
                  {formatCurrency(c.saldo)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fluxo de Caixa — tabela com números alinhados */}
      <div className="rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Fluxo de caixa · 6 meses</h2>
          <Link href="/financeiro/fluxo-caixa" className="text-sm text-indigo-600 hover:underline font-medium">
            Ver completo
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="pb-2.5 pr-4 font-medium">Mês</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Entradas</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Saídas</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Projetado</th>
                <th className="pb-2.5 text-right font-medium">Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {fluxo.map((m, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-4 text-slate-700">{m.mes}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">
                    {formatCurrency(m.entradasConfirmadas + m.entradasProjetadas)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">
                    {formatCurrency(m.saidasConfirmadas + m.saidasProjetadas)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-slate-400">
                    {formatCurrency(m.entradasProjetadas - m.saidasProjetadas)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-medium tabular-nums ${
                      m.saldoFinal >= 0 ? "text-slate-900" : "text-red-600"
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

      {/* Atalhos — texto simples, sem caixa pesada */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
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

function MiniStat({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "good" | "bad" | "warn";
}) {
  const subColor =
    subTone === "good" ? "text-emerald-600" : subTone === "bad" ? "text-red-600" : "text-amber-600";
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 whitespace-nowrap">{label}</p>
      <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-4 py-3 border border-slate-200 rounded-lg text-center text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
    >
      {label}
    </Link>
  );
}

function ExportadorFluxoCaixa() {
  const [empresas, setEmpresas] = useState<{ id: number; nome: string; cnpj: string }[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [mes, setMes] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");

  useEffect(() => {
    fetch("/api/minhas-empresas")
      .then((r) => {
        if (!r.ok) throw new Error(`Erro ${r.status} ao buscar empresas`);
        return r.json();
      })
      .then((data) => {
        const lista = Array.isArray(data) ? data : data?.value || data?.empresas || data?.data || [];
        if (lista.length === 0) {
          setErroCarregamento("Nenhuma empresa encontrada.");
        }
        setEmpresas(lista);
        if (lista.length > 0) setEmpresaId(String(lista[0].id));
      })
      .catch((e) => setErroCarregamento(e.message || "Erro ao carregar empresas."))
      .finally(() => setCarregando(false));
  }, []);

  function baixar(formato: "pdf" | "excel") {
    if (!empresaId) {
      alert("Selecione uma empresa antes de exportar.");
      return;
    }
    const params = new URLSearchParams();
    params.set("empresaId", empresaId);
    if (mes) params.set("mes", mes);
    window.open(`/api/financeiro/relatorios/fluxo-caixa/${formato}?${params.toString()}`, "_blank");
  }

  if (carregando) {
    return <span className="text-sm text-slate-500">Carregando empresas...</span>;
  }

  if (erroCarregamento) {
    return <span className="text-sm text-red-600">{erroCarregamento}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="min-w-[220px] px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
        value={empresaId}
        onChange={(e) => setEmpresaId(e.target.value)}
      >
        {empresas.length === 0 && <option value="">Nenhuma empresa</option>}
        {empresas.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.nome || `Empresa #${emp.id}`}
          </option>
        ))}
      </select>
      <select
        className="min-w-[140px] px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
        value={mes}
        onChange={(e) => setMes(e.target.value)}
      >
        <option value="">6 meses</option>
        {Array.from({ length: 12 }).map((_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() + i);
          const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
          return (
            <option key={valor} value={valor}>
              {label}
            </option>
          );
        })}
      </select>
      <button
        onClick={() => baixar("pdf")}
        disabled={!empresaId}
        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition"
      >
        PDF
      </button>
      <button
        onClick={() => baixar("excel")}
        disabled={!empresaId}
        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition"
      >
        Excel
      </button>
    </div>
  );
}
