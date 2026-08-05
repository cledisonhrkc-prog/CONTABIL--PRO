import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { getEmpresaAtiva } from "@/lib/empresa";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const emp = await getEmpresaAtiva().catch(() => null);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar cnpj={emp?.cnpj} nome={emp?.nome} />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
