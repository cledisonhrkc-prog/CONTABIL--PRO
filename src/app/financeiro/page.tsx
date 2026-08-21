"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  statusLabel,
  statusColor,
} from "@/utils/format";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Plus,
  ArrowLeftRight,
  Landmark,
} from "lucide-react";

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

  const resultadoMes =
    (fluxo[0]?.entradasConfirmadas || 0) +
    (fluxo[0]?.entradasProjetadas || 0) -
    (fluxo[0]?.saidasConfirmadas || 0) -
    (fluxo[0]?.saidasProjetadas || 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen -m-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-500">Visão completa de caixa, contas e fluxo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/lancamentos/novo"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Lançamento
          </Link>
          <Link
            href="/financeiro/transferencias"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            <ArrowLeftRight className="h-4 w-4" /> Transferência
          </Link>
          <Link
            href="/financeiro/contas-bancarias"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            <Landmark className="h-4 w-4" /> Contas Bancárias
          </Link>
        </div>
      </div>

      {/* Cards principais — ícone + valor, fundo branco, cor só no acento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          titulo="Saldo Bancário"
          valor={formatCurrency(saldos?.total || 0)}
          subtitulo={`${saldos?.porConta?.length || 0} conta(s)`}
          color="blue"
          href="/financeiro/contas-bancarias"
        />
        <StatCard
          icon={<ArrowDownCircle className="h-5 w-5" />}
          titulo="A Receber"
          valor={formatCurrency(resumo?.receber.total || 0)}
          subtitulo={
            resumo?.receber.vencido
              ? `Vencido: ${formatCurrency(resumo.receber.vencido)}`
              : `${resumo?.receber.quantidade || 0} títulos`
          }
          color="emerald"
          href="/financeiro/contas-receber"
          alerta={!!resumo?.receber.vencido}
        />
        <StatCard
          icon={<ArrowUpCircle className="h-5 w-5" />}
          titulo="A Pagar"
          valor={formatCurrency(resumo?.pagar.total || 0)}
          subtitulo={
            resumo?.pagar.vencido
              ? `Vencido: ${formatCurrency(resumo.pagar.vencido)}`
              : `${resumo?.pagar.quantidade || 0} títulos`
          }
          color="red"
          href="/financeiro/contas-pagar"
          alerta={!!resumo?.pagar.vencido}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          titulo="Resultado Projetado (mês)"
          valor={formatCurrency(resultadoMes)}
          subtitulo="Entradas − Saídas"
          color="violet"
          href="/financeiro/fluxo-caixa"
        />
      </div>

      {/* Exportar relatório — em card próprio, mais respiro que embutido no header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Exportar relatório de fluxo de caixa
        </h2>
        <ExportadorFluxoCaixa />
      </div>

      {/* Saldos por conta */}
      {saldos && saldos.porConta.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Saldos por Conta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saldos.porConta.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 hover:border-slate-200 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                  <div>
                    <p className="font-medium text-sm text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-400">{c.tipo}</p>
                  </div>
                </div>
                <p className={`font-semibold text-sm ${c.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(c.saldo)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fluxo de Caixa resumido */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Fluxo de Caixa (6 meses)</h2>
          <Link href="/financeiro/fluxo-caixa" className="text-sm text-blue-600 hover:underline font-medium">
            Ver completo →
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
                <th className="pb-2.5 text-right font-medium">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {fluxo.map((m, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">{m.mes}</td>
                  <td className="py-3 pr-4 text-right text-emerald-600">
                    {formatCurrency(m.entradasConfirmadas + m.entradasProjetadas)}
                  </td>
                  <td className="py-3 pr-4 text-right text-red-500">
                    {formatCurrency(m.saidasConfirmadas + m.saidasProjetadas)}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-400">
                    {formatCurrency(m.entradasProjetadas - m.saidasProjetadas)}
                  </td>
                  <td
                    className={`py-3 text-right font-semibold ${
                      m.saldoFinal >= 0 ? "text-emerald-700" : "text-red-700"
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

const COLOR_MAP: Record<string, { text: string; iconBg: string }> = {
  blue: { text: "text-blue-600", iconBg: "bg-blue-50" },
  emerald: { text: "text-emerald-600", iconBg: "bg-emerald-50" },
  red: { text: "text-red-600", iconBg: "bg-red-50" },
  violet: { text: "text-violet-600", iconBg: "bg-violet-50" },
};

function StatCard({
  icon,
  titulo,
  valor,
  subtitulo,
  color,
  href,
  alerta,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  subtitulo: string;
  color: "blue" | "emerald" | "red" | "violet";
  href: string;
  alerta?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <Link
      href={href}
      className="block p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg ${c.iconBg} ${c.text} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <p className="text-sm font-medium text-slate-600">{titulo}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{valor}</p>
      <p className={`text-xs mt-1 ${alerta ? "text-red-600 font-medium" : "text-slate-400"}`}>{subtitulo}</p>
    </Link>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block p-4 bg-white border border-slate-200 rounded-lg text-center text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition"
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
    return <span className="text-sm text-slate-500 px-2">Carregando empresas...</span>;
  }

  if (erroCarregamento) {
    return <span className="text-sm text-red-600 px-2">{erroCarregamento}</span>;
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
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
      >
        Exportar PDF
      </button>
      <button
        onClick={() => baixar("excel")}
        disabled={!empresaId}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
      >
        Exportar Excel
      </button>
    </div>
  );
}
