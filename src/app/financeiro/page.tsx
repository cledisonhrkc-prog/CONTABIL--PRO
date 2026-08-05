import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { db } from "@/db";
import { contasReceber, contasPagar } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const rec = await db.select().from(contasReceber).where(eq(contasReceber.empresa_id, emp.id)).orderBy(desc(contasReceber.vencimento)).limit(200);
  const pag = await db.select().from(contasPagar).where(eq(contasPagar.empresa_id, emp.id)).orderBy(desc(contasPagar.vencimento)).limit(200);
  const totalRec = rec.reduce((a, r) => a + Number(r.valor ?? 0), 0);
  const totalPag = pag.reduce((a, r) => a + Number(r.valor ?? 0), 0);

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Financeiro</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-emerald-200">
          <div className="text-xs text-slate-500">Total a Receber</div>
          <div className="text-2xl font-bold text-emerald-700">{fmtMoney(totalRec)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-red-200">
          <div className="text-xs text-slate-500">Total a Pagar</div>
          <div className="text-2xl font-bold text-red-700">{fmtMoney(totalPag)}</div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 text-white px-3 py-2 font-semibold">Contas a Receber</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs">
              <tr><th className="px-2 py-1.5 text-left">Cliente</th><th className="px-2 py-1.5">Emissão</th><th className="px-2 py-1.5">Venc.</th><th className="px-2 py-1.5 text-right">Valor</th></tr>
            </thead>
            <tbody>
              {rec.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-2 py-1 text-xs truncate max-w-xs">{r.participante}</td>
                  <td className="px-2 py-1 text-xs text-center">{r.emissao}</td>
                  <td className="px-2 py-1 text-xs text-center">{r.vencimento}</td>
                  <td className="px-2 py-1 text-xs text-right">{fmtMoney(Number(r.valor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-red-600 text-white px-3 py-2 font-semibold">Contas a Pagar</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs">
              <tr><th className="px-2 py-1.5 text-left">Fornecedor</th><th className="px-2 py-1.5">Emissão</th><th className="px-2 py-1.5">Venc.</th><th className="px-2 py-1.5 text-right">Valor</th></tr>
            </thead>
            <tbody>
              {pag.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-2 py-1 text-xs truncate max-w-xs">{r.participante}</td>
                  <td className="px-2 py-1 text-xs text-center">{r.emissao}</td>
                  <td className="px-2 py-1 text-xs text-center">{r.vencimento}</td>
                  <td className="px-2 py-1 text-xs text-right">{fmtMoney(Number(r.valor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
