import AppLayout from "@/components/AppLayout";
import { getEmpresaAtiva } from "@/lib/empresa";
import { db } from "@/db";
import { bancos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fmtMoney } from "@/components/Money";

export const dynamic = "force-dynamic";

export default async function EmpresaPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const b = await db.select().from(bancos).where(eq(bancos.empresa_id, emp.id));
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Dados da Empresa</h1>
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-slate-500">Razão Social</div><div className="font-medium">{emp.nome}</div></div>
          <div><div className="text-xs text-slate-500">CNPJ</div><div className="font-medium">{emp.cnpj}</div></div>
          <div><div className="text-xs text-slate-500">Regime Tributário</div><div className="font-medium">{emp.regime}</div></div>
          <div><div className="text-xs text-slate-500">Anexo do Simples</div><div className="font-medium">{emp.anexo_simples}</div></div>
          <div><div className="text-xs text-slate-500">Segmento</div><div className="font-medium">{emp.segmento}</div></div>
          <div><div className="text-xs text-slate-500">RBT12 (últimos 12 meses)</div><div className="font-medium">{fmtMoney(Number(emp.rbt12))}</div></div>
        </div>
      </div>
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Contas Bancárias</h2>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr>
            <th className="px-3 py-2 text-left">Banco</th><th className="px-3 py-2">Agência</th><th className="px-3 py-2">Conta</th><th className="px-3 py-2 text-right">Saldo</th>
          </tr></thead>
          <tbody>
            {b.map((x) => (
              <tr key={x.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{x.nome}</td>
                <td className="px-3 py-2 text-center text-xs">{x.agencia}</td>
                <td className="px-3 py-2 text-center text-xs">{x.conta}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtMoney(Number(x.saldo))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
