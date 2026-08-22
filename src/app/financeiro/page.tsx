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
  FileText,
  Receipt,
  ClipboardList,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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

interface Movimentacao {
  id: number;
  participante: string;
  valor: number;
  valorPago?: number;
  vencimento: string;
  status: string;
  tipo: "receber" | "pagar";
}

const STATUS_BADGE: Record<string, string> = {
  ABERTO: "bg-amber-50 text-amber-700",
  PARCIAL: "bg-blue-50 text-blue-700",
  PAGO: "bg-emerald-50 text-emerald-700",
  RECEBIDO: "bg-emerald-50 text-emerald-700",
  VENCIDO: "bg-red-50 text-red-700",
};

export default function FinanceiroDashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [saldos, setSaldos] = useState<{ total: number; porConta: SaldoConta[] } | null>(null);
  const [fluxo, setFluxo] = useState<FluxoMes[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
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
        const [r1, r2, r3, receber, pagar] = await Promise.all([
          fetchJson("/api/financeiro/resumo"),
          fetchJson("/api/financeiro/saldos"),
          fetchJson("/api/financeiro/fluxo-caixa?meses=6"),
          fetchJson("/api/financeiro/contas-receber?limit=5").catch(() => []),
          fetchJson("/api/financeiro/contas-pagar?limit=5").catch(() => []),
        ]);
        setResumo(r1);
        setSaldos(r2);
        setFluxo(r3);

        // Combina as contas a receber/pagar mais recentes como "movimentações"
        // — dado real do sistema, não inventado.
        const listaReceber = Array.isArray(receber) ? receber : receber?.value || [];
        const listaPagar = Array.isArray(pagar) ? pagar : pagar?.value || [];
        const combinado: Movimentacao[] = [
          ...listaReceber.map((c: any) => ({ ...c, tipo: "receber" as const })),
          ...listaPagar.map((c: any) => ({ ...c, tipo: "pagar" as const })),
        ]
          .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime())
          .slice(0, 5);
        setMovimentacoes(combinado);
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

  const totalEntradas6m = fluxo.reduce((s, m) => s + m.entradasConfirmadas + m.entradasProjetadas, 0);
  const totalSaidas6m = fluxo.reduce((s, m) => s + m.saidasConfirmadas + m.saidasProjetadas, 0);

  const dadosGrafico = fluxo.map((m) => ({
    mes: m.mes.replace(". de ", "/"),
    Entradas: m.entradasConfirmadas + m.entradasProjetadas,
    Saídas: m.saidasConfirmadas + m.saidasProjetadas,
    "Saldo Final": m.saldoFinal,
  }));

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Visão completa de caixa, contas e fluxo</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/financeiro/lancamentos/novo"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              <Plus className="h-4 w-4" /> Lançamento
            </Link>
            <Link
              href="/financeiro/transferencias"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              <ArrowLeftRight className="h-4 w-4" /> Transferência
            </Link>
            <Link
              href="/financeiro/contas-bancarias"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              <Landmark className="h-4 w-4" /> Contas
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-5">
      {/* Cards de resumo — fundo colorido cheio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          titulo="Saldo Bancário"
          valor={formatCurrency(saldos?.total || 0)}
          sub={`${saldos?.porConta?.length || 0} conta(s)`}
          color="blue"
        />
        <StatCard
          icon={<ArrowDownCircle className="h-5 w-5" />}
          titulo="A Receber"
          valor={formatCurrency(resumo?.receber.total || 0)}
          sub={resumo?.receber.vencido ? `${formatCurrency(resumo.receber.vencido)} vencido` : `${resumo?.receber.quantidade || 0} títulos`}
          color="emerald"
          alerta={!!resumo?.receber.vencido}
        />
        <StatCard
          icon={<ArrowUpCircle className="h-5 w-5" />}
          titulo="A Pagar"
          valor={formatCurrency(resumo?.pagar.total || 0)}
          sub={resumo?.pagar.vencido ? `${formatCurrency(resumo.pagar.vencido)} vencido` : `${resumo?.pagar.quantidade || 0} títulos`}
          color="red"
          alerta={!!resumo?.pagar.vencido}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          titulo="Resultado (mês)"
          valor={formatCurrency(resultadoMes)}
          sub="Entradas − Saídas"
          color="violet"
        />
      </div>

      {/* Grid principal: gráfico + resumo do mês | movimentações recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" /> Fluxo de Caixa · 6 meses
            </h2>
            <Link href="/financeiro/fluxo-caixa" className="text-sm text-indigo-600 hover:underline font-medium">
              Ver completo →
            </Link>
          </div>
          {dadosGrafico.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Saldo Final" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400">Total de entradas</p>
              <p className="text-sm font-semibold text-emerald-600">{formatCurrency(totalEntradas6m)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total de saídas</p>
              <p className="text-sm font-semibold text-red-600">{formatCurrency(totalSaidas6m)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Saldo projetado final</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(fluxo[fluxo.length - 1]?.saldoFinal || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Movimentações recentes — dado real (contas a receber/pagar mais próximas) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" /> Movimentações
            </h2>
            <Link href="/financeiro/lancamentos" className="text-sm text-indigo-600 hover:underline font-medium">
              Ver todas
            </Link>
          </div>
          {movimentacoes.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma movimentação recente.</p>
          ) : (
            <div className="space-y-1">
              {movimentacoes.map((m) => (
                <div key={`${m.tipo}-${m.id}`} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        m.tipo === "receber" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {m.tipo === "receber" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.participante || "—"}</p>
                      <p className="text-xs text-slate-400">{formatDate(m.vencimento)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-sm font-semibold ${m.tipo === "receber" ? "text-emerald-600" : "text-red-600"}`}>
                      {m.tipo === "receber" ? "+" : "-"}
                      {formatCurrency(m.valor)}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[m.status] || "bg-slate-50 text-slate-500"}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exportar relatório */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" /> Exportar Relatório
        </h2>
        <ExportadorFluxoCaixa />
      </div>

      {/* Atalhos — cards com ícone colorido e botão */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AtalhoCard href="/financeiro/contas-receber" icon={<Receipt className="h-5 w-5" />} label="Contas a Receber" color="emerald" />
        <AtalhoCard href="/financeiro/contas-pagar" icon={<Wallet className="h-5 w-5" />} label="Contas a Pagar" color="red" />
        <AtalhoCard href="/financeiro/lancamentos" icon={<ClipboardList className="h-5 w-5" />} label="Lançamentos" color="blue" />
        <AtalhoCard href="/financeiro/conciliacao" icon={<RefreshCw className="h-5 w-5" />} label="Conciliação" color="violet" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Atalho href="/financeiro/categorias" label="Categorias" />
        <Atalho href="/financeiro/contas-bancarias" label="Contas Bancárias" />
        <Atalho href="/financeiro/transferencias" label="Transferências" />
        <Atalho href="/financeiro/fluxo-caixa" label="Fluxo de Caixa" />
      </div>
      </div>
    </div>
  );
}

const CARD_STYLE: Record<string, string> = {
  blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
  emerald: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
  red: "bg-gradient-to-br from-red-500 to-red-600 text-white",
  violet: "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
};

function StatCard({
  icon,
  titulo,
  valor,
  sub,
  color,
  alerta,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  sub: string;
  color: "blue" | "emerald" | "red" | "violet";
  alerta?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl shadow-lg ${CARD_STYLE[color]}`}>
      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-90">{titulo}</p>
      <p className="text-2xl font-bold mt-1">{valor}</p>
      <p className={`text-xs mt-1 ${alerta ? "font-semibold" : "opacity-80"}`}>{sub}</p>
    </div>
  );
}

const ATALHO_COLOR: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  red: "bg-red-100 text-red-600",
  violet: "bg-violet-100 text-violet-600",
};

function AtalhoCard({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: "blue" | "emerald" | "red" | "violet";
}) {
  return (
    <Link
      href={href}
      className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition flex flex-col items-center text-center gap-2"
    >
      <div className={`h-11 w-11 rounded-full ${ATALHO_COLOR[color]} flex items-center justify-center`}>{icon}</div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </Link>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block p-3 bg-white border border-slate-200 rounded-lg text-center text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition"
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
