import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { dre, balanco } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";
import { db } from "@/db";
import { exercicios } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DrePage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const exsRaw = await db.select().from(exercicios).where(eq(exercicios.empresa_id, emp.id));
  const exsMap = new Map<number, (typeof exsRaw)[number]>();
  for (const e of exsRaw) if (!exsMap.has(e.ano)) exsMap.set(e.ano, e);
  const exs = Array.from(exsMap.values()).sort((a, b) => a.ano - b.ano);
  const bal = await balanco(emp.id);
  const dres = await Promise.all(exs.map(async (e) => ({ ano: e.ano, linhas: await dre(emp.id, e.ano) })));

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Demonstrações Contábeis</h1>

      <section className="mb-6">
        <h2 className="font-semibold text-slate-700 mb-2">Balanço Patrimonial (sintético)</h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr><th className="px-3 py-2 text-left">Grupo</th><th className="px-3 py-2 text-right">Saldo</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="px-3 py-2 font-medium">ATIVO</td><td className="px-3 py-2 text-right">{fmtMoney(bal.ativo)}</td></tr>
              <tr className="bg-slate-50 border-b"><td className="px-3 py-2 font-medium">PASSIVO</td><td className="px-3 py-2 text-right">{fmtMoney(bal.passivo)}</td></tr>
              <tr className="border-b"><td className="px-3 py-2 font-medium">PATRIMÔNIO LÍQUIDO</td><td className="px-3 py-2 text-right">{fmtMoney(bal.pl)}</td></tr>
              <tr className="bg-emerald-50 font-bold">
                <td className="px-3 py-2">Verificação (A - P - PL)</td>
                <td className="px-3 py-2 text-right">{fmtMoney(bal.ativo - bal.passivo - bal.pl)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-700 mb-2">DRE por Exercício</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {dres.map(({ ano, linhas }) => (
            <div key={ano} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-indigo-600 text-white px-3 py-2 font-semibold text-sm">DRE {ano}</div>
              <table className="w-full text-sm">
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className={l.destaque ? "bg-slate-100 font-bold" : "border-b border-slate-100"}>
                      <td className="px-3 py-1.5">{l.descricao}</td>
                      <td className={`px-3 py-1.5 text-right ${l.valor < 0 ? "text-red-600" : ""}`}>{fmtMoney(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
