import AppLayout from "@/components/AppLayout";

export default function ConfigPage() {
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Configurações</h1>
      <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl">
        <h2 className="font-semibold text-slate-800 mb-2">Sobre o SIGC Contábil Pro</h2>
        <p className="text-sm text-slate-600 mb-3">
          Sistema de escrituração contábil-fiscal automatizado a partir de NF-e (XML).
        </p>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>• Método das partidas dobradas com fechamento validado</li>
          <li>• Regimes suportados: Simples Nacional, Lucro Presumido, Lucro Real</li>
          <li>• Anexos do Simples: I, II, III, IV, V (LC 123/2006)</li>
          <li>• Alíquota efetiva do Anexo I calculada dinamicamente (RBT12 × alíq − PD)/RBT12</li>
          <li>• Auditoria R08 — Monofásico PIS/COFINS (Lei 10.147/2000, 10.485/2002, 13.097/2015)</li>
          <li>• Exportação Excel (10+ planilhas) e Word (parecer técnico)</li>
        </ul>
      </div>
    </AppLayout>
  );
}
