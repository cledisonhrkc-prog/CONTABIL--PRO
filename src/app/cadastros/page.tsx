import AppLayout from "@/components/AppLayout";
import { db } from "@/db";
import { planoContas } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  const contas = await db.select().from(planoContas).orderBy(asc(planoContas.codigo));
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Plano de Contas</h1>
      <p className="text-sm text-slate-500 mb-4">Estrutura contábil padrão utilizada pelo sistema — {contas.length} contas</p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Natureza</th>
              <th className="px-3 py-2 text-center">Nível</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c, i) => (
              <tr key={c.codigo} className={i % 2 ? "bg-slate-50" : ""}>
                <td className="px-3 py-1.5 font-mono text-xs">{c.codigo}</td>
                <td className="px-3 py-1.5" style={{ paddingLeft: `${(c.nivel - 1) * 20 + 12}px` }}>{c.descricao}</td>
                <td className="px-3 py-1.5 text-xs">{c.tipo}</td>
                <td className="px-3 py-1.5 text-xs">{c.natureza}</td>
                <td className="px-3 py-1.5 text-center text-xs">{c.nivel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
