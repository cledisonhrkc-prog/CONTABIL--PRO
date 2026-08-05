import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function ContabilPage() {
  const cards = [
    { titulo: "Plano de Contas", href: "/cadastros" },
    { titulo: "Lançamentos", href: "/lancamentos" },
    { titulo: "Livro Razão", href: "/razao" },
    { titulo: "Balancete", href: "/balancete" },
    { titulo: "DRE / Balanço", href: "/dre" },
    { titulo: "Apuração de Impostos", href: "/apuracao" },
  ];
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Módulo Contábil</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md">
            <div className="font-semibold text-slate-800">{c.titulo}</div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
