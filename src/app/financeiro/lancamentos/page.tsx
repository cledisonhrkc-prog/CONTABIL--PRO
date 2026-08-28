import { db } from "@/db";
import { lancamentosFinanceiros, contasBancarias, categoriasFinanceiras } from "@/db/schema-financeiro";
import { eq, and, desc } from "drizzle-orm";
import { formatCurrency, formatDate, statusLabel, statusColor } from "@/lib/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LancamentosPage() {
  const lancamentos = await db
    .select({
      id: lancamentosFinanceiros.id,
      tipo: lancamentosFinanceiros.tipo,
      data: lancamentosFinanceiros.data,
      valor: lancamentosFinanceiros.valor,
      descricao: lancamentosFinanceiros.descricao,
      participante: lancamentosFinanceiros.participante,
      status: lancamentosFinanceiros.status,
      contaNome: contasBancarias.nome,
      categoriaNome: categoriasFinanceiras.nome,
    })
    .from(lancamentosFinanceiros)
    .leftJoin(contasBancarias, eq(lancamentosFinanceiros.contaBancariaId, contasBancarias.id))
    .leftJoin(categoriasFinanceiras, eq(lancamentosFinanceiros.categoriaId, categoriasFinanceiras.id))
    .orderBy(desc(lancamentosFinanceiros.data))
    .limit(200);

  return (
    <div className="min-h-screen bg-slate-50 -m-6">
      {/* Header com gradiente — mesmo padrão do resto do sistema */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Financeiro</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Lançamentos</h1>
            <p className="text-indigo-100 text-sm mt-1">{lancamentos.length} lançamento(s)</p>
          </div>
          <div className="flex gap-2">
            <Link href="/financeiro">
              <Button
                variant="outline"
                className="bg-white/15 text-white border-white/20 hover:bg-white/25"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
              </Button>
            </Link>
            <Link href="/financeiro/lancamentos/novo">
              <Button className="bg-white text-indigo-700 hover:bg-slate-50">
                <Plus className="h-4 w-4 mr-1.5" /> Novo Lançamento
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" /> Histórico
          </h2>
          {lancamentos.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhum lançamento cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.data)}</TableCell>
                    <TableCell className="font-medium">{l.descricao || "—"}</TableCell>
                    <TableCell className="text-slate-500">{l.participante || "—"}</TableCell>
                    <TableCell className="text-slate-500">{l.contaNome || "—"}</TableCell>
                    <TableCell className="text-slate-500">{l.categoriaNome || "—"}</TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        l.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {l.tipo === "ENTRADA" ? "+" : "-"}
                      {formatCurrency(Number(l.valor))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColor(l.status ?? "")}>{statusLabel(l.status ?? "—")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
