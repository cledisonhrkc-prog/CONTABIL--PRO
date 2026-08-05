import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { apuracao } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function ApuracaoPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const rows = await apuracao(emp.id);
  const totalPagar = rows.reduce((a, r) => a + r.a_pagar, 0);
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Apuração de Impostos</h1>
      <p className="text-sm text-slate-500 mb-4">Regime: <b>{emp.regime}</b> · Total a recolher: <b className="text-red-600">{fmtMoney(totalPagar)}</b></p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Período</th>
              <th className="px-3 py-2 text-left">Imposto</th>
              <th className="px-3 py-2 text-right">Débito</th>
              <th className="px-3 py-2 text-right">Crédito</th>
              <th className="px-3 py-2 text-right">Apurado</th>
              <th className="px-3 py-2 text-right">A Pagar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                <td className="px-3 py-2 font-medium">{r.periodo}</td>
                <td className="px-3 py-2 font-medium">{r.imposto}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(r.debito)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(r.credito)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(r.apurado)}</td>
                <td className="px-3 py-2 text-right font-bold text-red-600">{fmtMoney(r.a_pagar)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Sem apuração</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
