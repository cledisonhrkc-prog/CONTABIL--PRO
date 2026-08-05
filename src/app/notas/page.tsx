import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { notas } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-slate-500">Nenhuma empresa. <a className="text-indigo-600 underline" href="/importar">Importe XMLs</a>.</div>
      </AppLayout>
    );
  }
  const rows = await notas(emp.id, 500);
  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notas Fiscais</h1>
          <p className="text-sm text-slate-500">Últimas {rows.length} notas processadas</p>
        </div>
        <a href="/importar" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm">+ Importar XML</a>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-xs text-slate-600 border-b border-slate-200">
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Série</th>
                <th className="px-3 py-2">Op.</th>
                <th className="px-3 py-2">Finalidade</th>
                <th className="px-3 py-2">Emissão</th>
                <th className="px-3 py-2">Participante</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">ICMS</th>
                <th className="px-3 py-2 text-right">PIS</th>
                <th className="px-3 py-2 text-right">COFINS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-medium">{r.numero}</td>
                  <td className="px-3 py-1.5">{r.serie}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${r.tipo_operacao === "SAIDA" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {r.tipo_operacao}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{r.finalidade}</td>
                  <td className="px-3 py-1.5 text-xs">{r.data_emissao}</td>
                  <td className="px-3 py-1.5 truncate max-w-xs">{r.participante}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{fmtMoney(r.valor_total)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-slate-600">{fmtMoney(r.valor_icms)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-slate-600">{fmtMoney(r.valor_pis)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-slate-600">{fmtMoney(r.valor_cofins)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">Nenhuma nota processada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
