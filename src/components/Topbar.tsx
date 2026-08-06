"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

// Rotas indexadas para a pesquisa rápida
const ROTAS: Array<{ label: string; href: string; keywords: string }> = [
  { label: "Dashboard", href: "/", keywords: "dashboard home inicio" },
  { label: "Empresa", href: "/empresa", keywords: "empresa cnpj cadastro" },
  { label: "Cadastros / Plano de contas", href: "/cadastros", keywords: "cadastro plano contas" },
  { label: "Lançamentos", href: "/lancamentos", keywords: "lancamento partida dobrada" },
  { label: "Financeiro", href: "/financeiro", keywords: "financeiro pagar receber banco" },
  { label: "Fiscal", href: "/fiscal", keywords: "fiscal imposto sped" },
  { label: "Contábil", href: "/contabil", keywords: "contabil" },
  { label: "Notas Fiscais", href: "/notas", keywords: "notas nfe xml" },
  { label: "Importar XML", href: "/importar", keywords: "importar xml upload" },
  { label: "Balancete", href: "/balancete", keywords: "balancete verificacao contas" },
  { label: "DRE / Balanço", href: "/dre", keywords: "dre balanço patrimonial resultado" },
  { label: "Livro Razão", href: "/razao", keywords: "razao livro" },
  { label: "Apuração de Impostos", href: "/apuracao", keywords: "apuracao imposto icms pis cofins iss das" },
  { label: "Auditoria R08", href: "/auditoria", keywords: "auditoria monofasico r08 pis cofins" },
  { label: "Reforma 2027", href: "/reforma", keywords: "reforma tributaria cbs ibs is 2027" },
  { label: "Analisar com IA", href: "/analise-ia", keywords: "ia inteligencia artificial chatgpt claude gemini analise" },
  { label: "Relatórios", href: "/relatorios", keywords: "relatorios" },
  { label: "SPED / Exportar", href: "/exportar", keywords: "sped exportar pdf excel word" },
  { label: "Setup / Diagnóstico", href: "/setup", keywords: "setup diagnostico banco tabela" },
  { label: "Configurações", href: "/configuracoes", keywords: "configuracoes settings" },
];

export default function Topbar({ cnpj, nome }: { cnpj?: string; nome?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = q
    ? ROTAS.filter((r) => {
        const t = q.toLowerCase();
        return r.label.toLowerCase().includes(t) || r.keywords.toLowerCase().includes(t);
      }).slice(0, 8)
    : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (filtered.length > 0) {
      router.push(filtered[0].href);
      setQ("");
      setOpen(false);
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 sticky top-0 z-10">
      <form onSubmit={submit} className="flex-1 max-w-xl relative">
        <input
          type="text"
          placeholder="Pesquisar no sistema (ex: dre, apuração, reforma)..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {open && filtered.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg z-20 max-h-80 overflow-y-auto">
            {filtered.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="block px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                onClick={() => {
                  setQ("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-slate-400 ml-2">{r.href}</span>
              </Link>
            ))}
          </div>
        )}
      </form>
      <div className="flex items-center gap-4 text-sm ml-4">
        <Link href="/auditoria" title="Alertas / Auditoria R08" className="text-slate-600 hover:text-indigo-600 text-lg">
          🔔
        </Link>
        <Link href="/" title="Dashboard" className="text-slate-600 hover:text-indigo-600 text-lg">
          📊
        </Link>
        <Link href="/empresa" className="border-l border-slate-200 pl-4 flex items-center gap-2 hover:opacity-80">
          <div className="text-right">
            <div className="text-xs text-slate-500">CNPJ</div>
            <div className="text-sm font-medium text-slate-700">{cnpj ?? "—"}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {(nome ?? "PM").substring(0, 2).toUpperCase()}
          </div>
        </Link>
      </div>
    </header>
  );
}
