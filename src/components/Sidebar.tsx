"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  FileText,
  Scale,
  TrendingUp,
  Search,
  Flag,
  GitCompare,
  RefreshCw,
  Bot,
  FileBarChart,
  Database,
  Settings,
  Wallet,
  Users,
  LogOut,
  HeartPulse,
  SlidersHorizontal,
  CalendarClock,
  Landmark,
} from "lucide-react";

const menu: Array<{ label: string; href: string; icon: React.ElementType }> = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Empresa", href: "/empresa", icon: Building2 },
  { label: "Cadastros", href: "/cadastros", icon: ClipboardList },
  { label: "Lançamentos", href: "/lancamentos", icon: FileText },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Departamento Pessoal", href: "/dp", icon: Users },
  { label: "Config. Avançadas do Vínculo", href: "/dp/vinculos-config", icon: SlidersHorizontal },
  { label: "Folha — Eventos Especiais", href: "/dp/folha-avancada", icon: CalendarClock },
  { label: "Integração Contábil (Folha)", href: "/dp/contabil-parametros", icon: Landmark },
  { label: "Relatório de Convênio", href: "/dp/relatorio-convenio", icon: HeartPulse },
  { label: "Balancete", href: "/balancete", icon: Scale },
  { label: "DRE / Balanço", href: "/dre", icon: TrendingUp },
  { label: "Auditoria R08", href: "/auditoria", icon: Search },
  { label: "Reforma 2027", href: "/reforma", icon: Flag },
  { label: "Comparativo Regimes", href: "/comparativo", icon: GitCompare },
  { label: "Conciliação (vs Colab)", href: "/conciliacao", icon: RefreshCw },
  { label: "Analisar com IA", href: "/analise-ia", icon: Bot },
  { label: "Relatórios", href: "/relatorios", icon: FileBarChart },
  { label: "SPED / Exportar", href: "/exportar", icon: Database },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const [empresas, setEmpresas] = useState<{ id: number; nome: string; cnpj: string }[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    fetch("/api/minhas-empresas")
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : data?.value || data?.empresas || data?.data || [];
        setEmpresas(lista);
      })
      .catch(() => {});
    const match = document.cookie.match(/empresa_ativa_id=([^;]+)/);
    if (match) setEmpresaId(match[1]);
  }, []);

  async function trocarEmpresa(novoId: string) {
    setTrocando(true);
    try {
      const res = await fetch("/api/selecionar-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: Number(novoId) }),
      });
      if (!res.ok) throw new Error("Erro ao selecionar empresa");
      setEmpresaId(novoId);
      router.refresh();
    } catch (e) {
      alert("Erro ao trocar de empresa. Tenta de novo.");
    } finally {
      setTrocando(false);
    }
  }

  async function handleLogout() {
    setSaindo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // mesmo se der erro na chamada, ainda tenta mandar pro login
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
            C
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm leading-tight">CONTÁBIL PRO</div>
            <div className="text-[10px] text-slate-500">Sistema Contábil Completo</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-200">
        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">
          Cliente
        </label>
        <select
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 disabled:opacity-60"
          value={empresaId}
          onChange={(e) => trocarEmpresa(e.target.value)}
          disabled={trocando}
        >
          <option value="">Selecionar empresa...</option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.nome}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-3 mb-2">
          Menu Principal
        </div>
        {menu.map((m) => {
          const Icon = m.icon;
          const active = path === m.href || (m.href !== "/" && path?.startsWith(m.href));
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition ${
                active
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
              <span className="truncate">{m.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3 text-xs">
        <div className="text-slate-500">Exercício Contábil</div>
        <div className="font-bold text-slate-800">{new Date().getFullYear()}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-emerald-600 font-medium text-[11px]">Período Aberto</span>
        </div>
      </div>
      <button
        onClick={handleLogout}
        disabled={saindo}
        className="flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition border-t border-slate-200 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        <span>{saindo ? "Saindo..." : "Sair"}</span>
      </button>
      <div className="border-t border-slate-200 px-4 py-3 text-[10px] text-slate-400">
        v5.0.0 — SIGC
      </div>
    </aside>
  );
}
