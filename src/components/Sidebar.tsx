"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menu: Array<{ label: string; href: string; icon: string; group?: string }> = [
  { label: "Dashboard", href: "/", icon: "🏠" },
  { label: "Empresa", href: "/empresa", icon: "🏢" },
  { label: "Cadastros", href: "/cadastros", icon: "📋" },
  { label: "Lançamentos", href: "/lancamentos", icon: "📝" },
  { label: "Financeiro", href: "/financeiro", icon: "💰" },
  { label: "Fiscal", href: "/fiscal", icon: "🧾" },
  { label: "Contábil", href: "/contabil", icon: "📊" },
  { label: "Notas Fiscais", href: "/notas", icon: "📄" },
  { label: "Importar XML", href: "/importar", icon: "⬆️" },
  { label: "Balancete", href: "/balancete", icon: "⚖️" },
  { label: "DRE / Balanço", href: "/dre", icon: "📈" },
  { label: "Auditoria R08", href: "/auditoria", icon: "🔍" },
  { label: "Reforma 2027", href: "/reforma", icon: "🇧🇷" },
  { label: "Relatórios", href: "/relatorios", icon: "📑" },
  { label: "SPED / Exportar", href: "/exportar", icon: "💾" },
  { label: "Configurações", href: "/configuracoes", icon: "⚙️" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold">
            C
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">CONTÁBIL PRO</div>
            <div className="text-[10px] text-slate-500">Sistema Contábil Completo</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-3 mb-2">
          Menu Principal
        </div>
        {menu.map((m) => {
          const active = path === m.href || (m.href !== "/" && path.startsWith(m.href));
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition ${
                active
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="text-base">{m.icon}</span>
              <span>{m.label}</span>
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
      <div className="border-t border-slate-200 px-4 py-3 text-[10px] text-slate-400">
        v5.0.0 — SIGC
      </div>
    </aside>
  );
}
