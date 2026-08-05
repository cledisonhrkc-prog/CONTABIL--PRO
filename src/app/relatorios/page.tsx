import AppLayout from "@/components/AppLayout";
import Link from "next/link";

const relatorios = [
  { titulo: "Balancete de Verificação", desc: "Saldos por conta contábil", href: "/balancete", icon: "⚖️", color: "bg-emerald-500" },
  { titulo: "DRE / Balanço", desc: "Demonstração do Resultado e Balanço Patrimonial", href: "/dre", icon: "📈", color: "bg-indigo-500" },
  { titulo: "Livro Razão", desc: "Lançamentos por conta e período", href: "/razao", icon: "📚", color: "bg-blue-500" },
  { titulo: "Apuração de Impostos", desc: "ICMS, PIS, COFINS, IRPJ, CSLL, DAS", href: "/apuracao", icon: "🧾", color: "bg-amber-500" },
  { titulo: "Auditoria R08", desc: "Monofásico PIS/COFINS", href: "/auditoria", icon: "🔍", color: "bg-red-500" },
  { titulo: "Notas Fiscais", desc: "Lista completa de NF-e processadas", href: "/notas", icon: "📄", color: "bg-cyan-500" },
  { titulo: "Contas a Pagar/Receber", desc: "Fluxo financeiro consolidado", href: "/financeiro", icon: "💰", color: "bg-orange-500" },
  { titulo: "PDF Sênior", desc: "Parecer profissional em PDF (multi-página)", href: "/api/exportar/pdf", icon: "📄", color: "bg-red-700" },
  { titulo: "Excel Completo", desc: "Download com todas as planilhas", href: "/api/exportar/excel", icon: "📗", color: "bg-green-600" },
  { titulo: "Parecer Word", desc: "Parecer técnico contábil-fiscal", href: "/api/exportar/word", icon: "📘", color: "bg-blue-700" },
];

export default function RelatoriosPage() {
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Central de Relatórios</h1>
      <p className="text-sm text-slate-500 mb-6">Todos os relatórios contábeis, fiscais e gerenciais em um só lugar.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatorios.map((r) => (
          <Link key={r.href} href={r.href} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition">
            <div className={`w-11 h-11 rounded-lg ${r.color} text-white flex items-center justify-center text-xl mb-3`}>{r.icon}</div>
            <div className="font-semibold text-slate-800">{r.titulo}</div>
            <div className="text-xs text-slate-500 mt-1">{r.desc}</div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
