import AppLayout from "@/components/AppLayout";
import UsuariosClient from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default function UsuariosPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">👥 Gerenciar Usuários</h1>
        <p className="text-sm text-slate-500 mt-1">
          Crie logins e controle quais empresas cada um pode acessar.
        </p>
      </div>
      <UsuariosClient />
    </AppLayout>
  );
}
