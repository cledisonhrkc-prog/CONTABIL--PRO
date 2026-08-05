import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { auditoriaR08 } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const rows = await auditoriaR08(emp.id);
  const totalCred = rows.reduce((a, r) => a + r.valor_credito, 0);
  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Auditoria R08 — Monofásico PIS/COFINS</h1>
        <p className="text-sm text-slate-500">
          Detecção de itens com CST 01/02 em NCMs monofásicos (deveria ser 04). Fundamentação: Lei 10.147/2000, Lei 10.485/2002, Lei 13.097/2015.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500">Divergências detectadas</div>
          <div className="text-2xl font-bold text-red-600">{rows.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500">Crédito recuperável estimado</div>
          <div className="text-2xl font-bold text-emerald-600">{fmtMoney(totalCred)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500">Regra aplicada</div>
          <div className="text-lg font-bold text-slate-800">R08 — MONOFÁSICO</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500">Ação recomendada</div>
          <div className="text-xs text-slate-700">Retificar EFD-Contribuições, DCTF; PER/DCOMP.</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Nº NF</th>
              <th className="px-3 py-2 text-left">Regra</th>
              <th className="px-3 py-2 text-left">NCM</th>
              <th className="px-3 py-2 text-left">CST PIS/COFINS</th>
              <th className="px-3 py-2 text-left">Regime</th>
              <th className="px-3 py-2 text-right">Valor Nota</th>
              <th className="px-3 py-2 text-right">Crédito</th>
              <th className="px-3 py-2 text-left">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                <td className="px-3 py-1.5 font-mono text-xs">{r.numero_nf}</td>
                <td className="px-3 py-1.5"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">{r.regra}</span></td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.ncm}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.cst_pis}/{r.cst_cof}</td>
                <td className="px-3 py-1.5 text-xs">{r.regime}</td>
                <td className="px-3 py-1.5 text-right">{fmtMoney(r.valor_nota)}</td>
                <td className="px-3 py-1.5 text-right font-medium text-emerald-700">{fmtMoney(r.valor_credito)}</td>
                <td className="px-3 py-1.5 text-xs text-slate-600 max-w-xs truncate" title={r.descricao ?? ""}>{r.descricao}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-emerald-600">✅ Nenhuma divergência detectada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
