import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { razao } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function RazaoPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const rows = await razao(emp.id, 1000);
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Livro Razão</h1>
      <p className="text-sm text-slate-500 mb-4">Últimos {rows.length} lançamentos (mais recentes primeiro)</p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Lçto</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-left">Histórico</th>
                <th className="px-3 py-2 text-left">Conta</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-right">Débito</th>
                <th className="px-3 py-2 text-right">Crédito</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                  <td className="px-3 py-1 text-xs">{r.competencia}</td>
                  <td className="px-3 py-1 font-mono text-xs">{r.numero}</td>
                  <td className="px-3 py-1 text-xs">{r.origem}</td>
                  <td className="px-3 py-1 text-xs max-w-xs truncate" title={r.historico ?? ""}>{r.historico}</td>
                  <td className="px-3 py-1 font-mono text-xs">{r.codigo_conta}</td>
                  <td className="px-3 py-1 text-xs">{r.descricao}</td>
                  <td className="px-3 py-1 text-right text-xs">{r.debito > 0 ? fmtMoney(r.debito) : "-"}</td>
                  <td className="px-3 py-1 text-right text-xs">{r.credito > 0 ? fmtMoney(r.credito) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
