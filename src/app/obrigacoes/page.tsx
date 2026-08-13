import AppLayout from "@/components/AppLayout";
import { getEmpresaAtiva } from "@/lib/empresa";
import ObrigacoesClient from "./ObrigacoesClient";

export const dynamic = "force-dynamic";

export default async function ObrigacoesPage() {
  const emp = await getEmpresaAtiva();

  if (!emp) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-slate-500">
          Sem empresa cadastrada.{" "}
          <a className="text-indigo-600 underline" href="/importar">
            Importe XMLs para começar
          </a>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">📋 Obrigações Acessórias</h1>
        <p className="text-sm text-slate-500 mt-1">Prazos de {emp.nome}</p>
      </div>
      <ObrigacoesClient empresaId={emp.id} />
    </AppLayout>
  );
}
