import AppLayout from "@/components/AppLayout";
import { fmtMoney } from "@/components/Money";
import { getEmpresaAtiva } from "@/lib/empresa";
import { apuracaoReformaPorAno, comparativoAntesDepois } from "@/lib/reforma-relatorios";

export const dynamic = "force-dynamic";

const CRONOGRAMA = [
  { ano: "2025", label: "PRÉ-REFORMA", cor: "bg-slate-500", desc: "Sistema atual: PIS, COFINS, IPI, ICMS, ISS." },
  { ano: "2026", label: "TRANSIÇÃO — Início", cor: "bg-yellow-500", desc: "CBS 0,9% + IBS 0,1% em regime de teste (compensáveis com PIS/COFINS)." },
  { ano: "2027", label: "REFORMA — CBS cheia", cor: "bg-orange-500", desc: "PIS e COFINS EXTINTOS. CBS entra a ~8,8%. IPI zerado (exceto ZFM). Começa o Imposto Seletivo (IS)." },
  { ano: "2028", label: "REFORMA — 1º ano cheio", cor: "bg-orange-600", desc: "CBS e IS em regime normal; IBS ainda em fase de teste (0,1%)." },
  { ano: "2029-2032", label: "TRANSIÇÃO IBS", cor: "bg-red-500", desc: "IBS cresce progressivamente 10% ao ano; ICMS e ISS reduzem proporcionalmente." },
  { ano: "2033", label: "REFORMA COMPLETA", cor: "bg-red-700", desc: "IBS a ~17,7%. ICMS e ISS EXTINTOS. Novo sistema em vigor pleno." },
];

export default async function ReformaPage() {
  const emp = await getEmpresaAtiva();
  if (!emp)
    return (
      <AppLayout>
        <div className="text-center py-16 text-slate-500">
          Sem empresa cadastrada.{" "}
          <a className="text-indigo-600 underline" href="/importar">
            Importe XMLs ou gere demo
          </a>
        </div>
      </AppLayout>
    );

  const anos = await apuracaoReformaPorAno(emp.id);
  const comp = await comparativoAntesDepois(emp.id);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">🇧🇷 Reforma Tributária — EC 132/2023 + LC 214/2025</h1>
        <p className="text-sm text-slate-500 mt-1">
          Impacto da reforma nos tributos da empresa. O sistema já calcula CBS, IBS e Imposto Seletivo automaticamente conforme a data de emissão da nota.
        </p>
      </div>

      {/* Cronograma */}
      <section className="mb-8">
        <h2 className="font-semibold text-slate-700 mb-3">📅 Cronograma Oficial de Implementação</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CRONOGRAMA.map((c) => (
            <div key={c.ano} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`${c.cor} text-white text-xs font-bold px-2 py-0.5 rounded`}>{c.ano}</div>
                <div className="font-semibold text-slate-800 text-sm">{c.label}</div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo Antes x Depois */}
      <section className="mb-8">
        <h2 className="font-semibold text-slate-700 mb-3">⚖️ Comparativo Antes × Depois (dados reais desta empresa)</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border-l-4 border-slate-500 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pré-Reforma (≤ 2025)</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{fmtMoney(comp.pre_reforma.total_extintos)}</div>
            <div className="text-xs text-slate-500 mt-1">Total PIS+COFINS+IPI (extintos em 2027)</div>
            <div className="mt-3 text-xs space-y-1">
              <div>PIS: <b>{fmtMoney(comp.pre_reforma.pis)}</b></div>
              <div>COFINS: <b>{fmtMoney(comp.pre_reforma.cofins)}</b></div>
              <div>IPI: <b>{fmtMoney(comp.pre_reforma.ipi)}</b></div>
            </div>
          </div>

          <div className="bg-white border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Transição 2026</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{fmtMoney(comp.transicao_2026.cbs_teste + comp.transicao_2026.ibs_teste)}</div>
            <div className="text-xs text-slate-500 mt-1">CBS 0,9% + IBS 0,1% (teste, compensáveis)</div>
            <div className="mt-3 text-xs space-y-1">
              <div>CBS teste: <b>{fmtMoney(comp.transicao_2026.cbs_teste)}</b></div>
              <div>IBS teste: <b>{fmtMoney(comp.transicao_2026.ibs_teste)}</b></div>
              <div>Receita 2026: <b>{fmtMoney(comp.transicao_2026.receita)}</b></div>
            </div>
          </div>

          <div className="bg-white border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold text-orange-600 uppercase tracking-wide">Reforma 2027+</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{fmtMoney(comp.reforma_2027.total_novos)}</div>
            <div className="text-xs text-slate-500 mt-1">CBS (~8,8%) + IBS + IS</div>
            <div className="mt-3 text-xs space-y-1">
              <div>CBS: <b className="text-orange-700">{fmtMoney(comp.reforma_2027.cbs)}</b></div>
              <div>IBS: <b>{fmtMoney(comp.reforma_2027.ibs)}</b></div>
              <div>IS (Seletivo): <b className="text-red-600">{fmtMoney(comp.reforma_2027.is)}</b></div>
            </div>
          </div>
        </div>
      </section>

      {/* Apuração por ano */}
      <section>
        <h2 className="font-semibold text-slate-700 mb-3">📊 Apuração Detalhada por Exercício</h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Ano</th>
                <th className="px-3 py-2 text-left">Modo</th>
                <th className="px-3 py-2 text-right">Receita</th>
                <th className="px-3 py-2 text-right">PIS</th>
                <th className="px-3 py-2 text-right">COFINS</th>
                <th className="px-3 py-2 text-right">IPI</th>
                <th className="px-3 py-2 text-right">ICMS</th>
                <th className="px-3 py-2 text-right">ISS</th>
                <th className="px-3 py-2 text-right bg-orange-600">CBS</th>
                <th className="px-3 py-2 text-right bg-orange-600">IBS</th>
                <th className="px-3 py-2 text-right bg-red-600">IS</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a.ano} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-bold">{a.ano}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded text-white text-[10px] ${
                      a.modo === "PRE_REFORMA" ? "bg-slate-500" :
                      a.modo === "TRANSICAO_2026" ? "bg-yellow-500" :
                      a.modo === "REFORMA_2027" ? "bg-orange-500" :
                      a.modo === "REFORMA_2029" ? "bg-red-500" :
                      "bg-red-700"
                    }`}>{a.modo}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(a.receita)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtMoney(a.pis)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtMoney(a.cofins)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtMoney(a.ipi)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtMoney(a.icms)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtMoney(a.iss)}</td>
                  <td className="px-3 py-2 text-right font-medium text-orange-700 bg-orange-50">{fmtMoney(a.cbs)}</td>
                  <td className="px-3 py-2 text-right font-medium text-orange-700 bg-orange-50">{fmtMoney(a.ibs)}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-700 bg-red-50">{fmtMoney(a.is)}</td>
                </tr>
              ))}
              {anos.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-400">
                    Sem dados. <a href="/importar" className="text-indigo-600 underline">Gere um lote de teste</a> com notas de 2025, 2026 e 2027.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm">
        <h3 className="font-semibold text-amber-900 mb-2">📚 Base legal implementada</h3>
        <ul className="text-amber-900 space-y-1 text-xs">
          <li>• <b>EC 132/2023</b> — Emenda Constitucional que instituiu a Reforma Tributária do Consumo</li>
          <li>• <b>LC 214/2025</b> — Lei Complementar que regulamenta CBS, IBS e IS</li>
          <li>• <b>Alíquotas de referência</b>: CBS 8,8% + IBS 17,7% (total esperado ~26,5%) — Ministério da Fazenda 2025</li>
          <li>• <b>Imposto Seletivo</b>: incide sobre bebidas alcoólicas, açucaradas, tabaco, veículos poluentes, mineração e apostas</li>
          <li>• <b>Simples Nacional</b>: mantém regime unificado (DAS), com opção híbrida para dar crédito CBS/IBS ao adquirente (LC 214/2025 art. 41)</li>
        </ul>
      </section>
    </AppLayout>
  );
}
