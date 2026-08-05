import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { balancete } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function BalancetePage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const rows = await balancete(emp.id);
  const totalDebito = rows.reduce((a, r) => a + r.debito, 0);
  const totalCredito = rows.reduce((a, r) => a + r.credito, 0);
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Balancete de Verificação</h1>
      <p className="text-sm text-slate-500 mb-4">Saldos por conta contábil — {rows.length} contas movimentadas</p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-right">Débito</th>
              <th className="px-3 py-2 text-right">Crédito</th>
              <th className="px-3 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                <td className="px-3 py-1.5 font-mono text-xs">{r.codigo}</td>
                <td className="px-3 py-1.5">{r.descricao}</td>
                <td className="px-3 py-1.5 text-xs text-slate-500">{r.tipo}</td>
                <td className="px-3 py-1.5 text-right text-slate-700">{fmtMoney(r.debito)}</td>
                <td className="px-3 py-1.5 text-right text-slate-700">{fmtMoney(r.credito)}</td>
                <td className="px-3 py-1.5 text-right font-medium">{fmtMoney(r.saldo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right">TOTAIS</td>
              <td className="px-3 py-2 text-right">{fmtMoney(totalDebito)}</td>
              <td className="px-3 py-2 text-right">{fmtMoney(totalCredito)}</td>
              <td className="px-3 py-2 text-right">Δ {fmtMoney(totalDebito - totalCredito)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AppLayout>
  );
}
