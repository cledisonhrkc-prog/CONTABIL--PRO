import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { apuracao } from "@/lib/relatorios";
import { getEmpresaAtiva } from "@/lib/empresa";

export const dynamic = "force-dynamic";

export default async function FiscalPage() {
  const emp = await getEmpresaAtiva();
  if (!emp) return <AppLayout><div className="text-center py-16 text-slate-500">Sem empresa</div></AppLayout>;
  const rows = await apuracao(emp.id);
  const porImposto: Record<string, number> = {};
  for (const r of rows) porImposto[r.imposto] = (porImposto[r.imposto] ?? 0) + r.a_pagar;

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Painel Fiscal</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(porImposto).map(([imp, v]) => (
          <div key={imp} className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500 uppercase">{imp}</div>
            <div className="text-lg font-bold text-slate-800">{fmtMoney(v)}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="font-semibold text-slate-800 mb-2">Obrigações Acessórias (referencial)</h2>
        <ul className="text-sm text-slate-600 grid md:grid-cols-2 gap-2">
          <li>✅ SPED ECD — Escrituração Contábil Digital</li>
          <li>✅ SPED EFD ICMS/IPI</li>
          <li>✅ SPED EFD Contribuições</li>
          <li>✅ DCTFWeb</li>
          <li>✅ DIRF / RAIS / DASN-SIMEI / ECF</li>
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          Este sistema gera dados de escrituração base. A transmissão oficial dessas obrigações é feita pela contabilidade responsável.
        </p>
      </div>
    </AppLayout>
  );
}
