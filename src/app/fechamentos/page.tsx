import AppLayout from "@/components/AppLayout";
import FechamentoClient from "./FechamentoClient";

export const dynamic = "force-dynamic";

export default function FechamentosPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">📅 Fechamento Mensal</h1>
        <p className="text-sm text-slate-500 mt-1">
          Escolha o cliente e o mês para gerar o PDF de fechamento, sem misturar com o parecer completo.
        </p>
      </div>
      <FechamentoClient />
    </AppLayout>
  );
}
