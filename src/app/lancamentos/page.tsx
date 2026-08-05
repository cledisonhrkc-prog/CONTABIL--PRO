import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { db } from "@/db";
import { lancamentos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function LancamentosPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const lc = await db.select().from(lancamentos).where(eq(lancamentos.empresa_id, emp.id)).orderBy(desc(lancamentos.id)).limit(200);
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Lançamentos Contábeis</h1>
      <p className="text-sm text-slate-500 mb-4">Últimos {lc.length} lançamentos (partidas dobradas)</p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Número</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Histórico</th>
              <th className="px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lc.map((r, i) => (
              <tr key={r.id} className={i % 2 ? "bg-slate-50" : ""}>
                <td className="px-3 py-1.5 font-mono text-xs">{r.numero}</td>
                <td className="px-3 py-1.5 text-xs">{r.data}</td>
                <td className="px-3 py-1.5 text-xs">{r.origem}</td>
                <td className="px-3 py-1.5 text-xs">{r.tipo_lanc}</td>
                <td className="px-3 py-1.5 text-xs truncate max-w-md">{r.historico}</td>
                <td className="px-3 py-1.5 text-right font-medium">{fmtMoney(Number(r.valor_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
