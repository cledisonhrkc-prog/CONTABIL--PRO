import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import {
  dashboardResumo,
  fluxoCaixaMensal,
  topDespesas,
  atividadesRecentes,
  apuracao,
} from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";
import Link from "next/link";
import { db } from "@/db";
import { bancos } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ACESSOS = [
  { label: "Importar XML", icon: "⬆️", color: "bg-amber-500", href: "/importar" },
  { label: "Plano de Contas", icon: "📋", color: "bg-indigo-500", href: "/cadastros" },
  { label: "Lançamentos", icon: "📝", color: "bg-indigo-500", href: "/lancamentos" },
  { label: "Notas Fiscais", icon: "🧾", color: "bg-red-500", href: "/notas" },
  { label: "Balancete", icon: "⚖️", color: "bg-emerald-600", href: "/balancete" },
  { label: "DRE", icon: "📈", color: "bg-blue-500", href: "/dre" },
  { label: "Razão", icon: "📚", color: "bg-cyan-500", href: "/razao" },
  { label: "Apuração", icon: "🧾", color: "bg-orange-500", href: "/apuracao" },
  { label: "Auditoria", icon: "🔍", color: "bg-purple-500", href: "/auditoria" },
  { label: "Reforma 2027", icon: "🇧🇷", color: "bg-green-600", href: "/reforma" },
  { label: "PDF", icon: "📄", color: "bg-red-700", href: "/api/exportar/pdf" },
  { label: "Excel", icon: "📗", color: "bg-green-700", href: "/api/exportar/excel" },
];

export default async function Home() {
  const emp = await getEmpresaAtiva().catch(() => null);
  if (!emp) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-6xl mb-4">🚀</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">Bem-vindo ao SIGC Contábil Pro</h1>
          <p className="text-slate-600 mb-6">
            Nenhuma empresa cadastrada ainda. Clique no botão abaixo para popular o sistema com 1000 notas fiscais fictícias e explorar todas as funcionalidades.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/importar"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              📤 Importar XMLs
            </Link>
            <Link
              href="/setup"
              className="inline-block px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
            >
              ⚙️ Setup
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Comece importando os XMLs de NF-e da empresa.
          </p>
        </div>
      </AppLayout>
    );
  }

  const resumo = await dashboardResumo(emp.id);
  const fluxo = await fluxoCaixaMensal(emp.id);
  const top = await topDespesas(emp.id, 5);
  const ativ = await atividadesRecentes(emp.id, 6);
  const ap = await apuracao(emp.id);
  const contas = await db.select().from(bancos).where(eq(bancos.empresa_id, emp.id));
  const totalContas = contas.reduce((a, b) => a + Number(b.saldo ?? 0), 0);

  return (
    <AppLayout>
      {/* Acesso Rápido */}
      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-3">
          {ACESSOS.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center gap-2 hover:shadow-md transition"
            >
              <div className={`w-9 h-9 rounded-md ${a.color} flex items-center justify-center text-white text-lg`}>
                {a.icon}
              </div>
              <div className="text-[10px] text-slate-600 text-center leading-tight">{a.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* KPIs */}
      <section className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mb-4">Visão geral da empresa {emp.nome}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPI icon="💵" iconBg="bg-emerald-100" iconColor="text-emerald-600" label="RECEITAS" value={fmtMoney(resumo.receitas)} sub="Vendas registradas" />
          <KPI icon="💸" iconBg="bg-red-100" iconColor="text-red-600" label="DESPESAS" value={fmtMoney(resumo.despesas)} sub="Compras registradas" />
          <KPI icon="📈" iconBg="bg-green-100" iconColor="text-green-600" label="RESULTADO" value={fmtMoney(resumo.receitas - resumo.despesas)} sub="Receitas − Despesas" />
          <KPI icon="🏦" iconBg="bg-blue-100" iconColor="text-blue-600" label="SALDO BANCÁRIO" value={fmtMoney(totalContas)} sub={`${contas.length} contas`} />
          <KPI icon="📥" iconBg="bg-cyan-100" iconColor="text-cyan-600" label="CONTAS A RECEBER" value={fmtMoney(resumo.contas_receber)} sub="Em aberto" />
          <KPI icon="📤" iconBg="bg-orange-100" iconColor="text-orange-600" label="CONTAS A PAGAR" value={fmtMoney(resumo.contas_pagar)} sub="Em aberto" />
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Atividades */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Atividades Recentes</h3>
          </div>
          <ul className="space-y-3">
            {ativ.map((a) => (
              <li key={a.numero} className="flex items-start gap-3 text-sm border-b border-slate-100 pb-2 last:border-0">
                <div className="w-8 h-8 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                  📝
                </div>
                <div className="flex-1">
                  <div className="text-slate-800 font-medium">{a.historico}</div>
                  <div className="text-xs text-slate-500">[{a.origem}] {a.numero} — {fmtMoney(a.valor)}</div>
                </div>
                <div className="text-xs text-slate-400">{a.data}</div>
              </li>
            ))}
            {ativ.length === 0 && <li className="text-sm text-slate-400">Sem atividades ainda.</li>}
          </ul>
        </div>

        {/* Fluxo de Caixa */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Fluxo de Caixa</h3>
            <span className="text-xs text-slate-500">Mensal</span>
          </div>
          <FluxoChart data={fluxo.slice(-12)} />
        </div>

        {/* Top Despesas */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Top 5 Fornecedores</h3>
          </div>
          <ul className="space-y-2 text-sm">
            {top.map((t, i) => {
              const totalTop = top.reduce((a, x) => a + x.total, 0) || 1;
              const pct = ((t.total / totalTop) * 100).toFixed(1);
              const colors = ["bg-indigo-500", "bg-emerald-500", "bg-red-500", "bg-amber-500", "bg-cyan-500"];
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                  <span className="flex-1 truncate text-slate-700">{t.participante}</span>
                  <span className="text-xs text-slate-500">{pct}%</span>
                  <span className="w-24 text-right text-slate-700 font-medium">{fmtMoney(t.total)}</span>
                </li>
              );
            })}
            {top.length === 0 && <li className="text-slate-400">Sem dados</li>}
          </ul>
        </div>
      </div>

      {/* Situação Fiscal e Contas Bancárias */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Apuração de Impostos por Período</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2">Período</th>
                  <th className="py-2">Imposto</th>
                  <th className="py-2 text-right">Débito</th>
                  <th className="py-2 text-right">Crédito</th>
                  <th className="py-2 text-right">A Pagar</th>
                </tr>
              </thead>
              <tbody>
                {ap.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2">{r.periodo}</td>
                    <td className="py-2 font-medium">{r.imposto}</td>
                    <td className="py-2 text-right">{fmtMoney(r.debito)}</td>
                    <td className="py-2 text-right">{fmtMoney(r.credito)}</td>
                    <td className="py-2 text-right font-medium text-red-600">{fmtMoney(r.a_pagar)}</td>
                  </tr>
                ))}
                {ap.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">Sem apuração ainda</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Contas Bancárias</h3>
          <ul className="space-y-3 text-sm">
            {contas.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <div className="font-medium text-slate-700">{c.nome}</div>
                  <div className="text-xs text-slate-400">Ag: {c.agencia} · C/C: {c.conta}</div>
                </div>
                <div className="text-right text-emerald-700 font-medium">{fmtMoney(Number(c.saldo))}</div>
              </li>
            ))}
            {contas.length === 0 && <li className="text-slate-400">Nenhuma conta cadastrada</li>}
          </ul>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-sm font-semibold">
            <span>Total Geral</span>
            <span className="text-emerald-700">{fmtMoney(totalContas)}</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function KPI({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center text-lg`}>
          {icon}
        </div>
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function FluxoChart({ data }: { data: { mes: string; entradas: number; saidas: number; saldo: number }[] }) {
  if (data.length === 0) return <div className="text-sm text-slate-400 py-8 text-center">Sem dados</div>;
  const max = Math.max(...data.map((d) => Math.max(d.entradas, d.saidas))) || 1;
  return (
    <div>
      <div className="flex items-end gap-1 h-40">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end justify-center gap-0.5 h-full">
              <div
                className="w-1/2 bg-emerald-500 rounded-t"
                style={{ height: `${(d.entradas / max) * 100}%` }}
                title={`Entradas: ${fmtMoney(d.entradas)}`}
              />
              <div
                className="w-1/2 bg-red-400 rounded-t"
                style={{ height: `${(d.saidas / max) * 100}%` }}
                title={`Saídas: ${fmtMoney(d.saidas)}`}
              />
            </div>
            <div className="text-[8px] text-slate-500">{d.mes.substring(5)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500" /> Entradas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400" /> Saídas</span>
      </div>
    </div>
  );
}
