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
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { getAuthContext } from "@/lib/auth-financeiro";

// Página mostra dado por empresa/sessão logada — nunca pode ser estática
export const dynamic = "force-dynamic";

export default async function LancamentosPage() {
  const { empresaId } = await getAuthContext();

  const lancamentos = await db
    .select({
      id: lancamentosFinanceiros.id,
      tipo: lancamentosFinanceiros.tipo,
      data: lancamentosFinanceiros.data,
      valor: lancamentosFinanceiros.valor,
      descricao: lancamentosFinanceiros.descricao,
      participante: lancamentosFinanceiros.participante,
      status: lancamentosFinanceiros.status,
      origem: lancamentosFinanceiros.origem,
      formaPagamento: lancamentosFinanceiros.formaPagamento,
      contaNome: contasBancarias.nome,
      categoriaNome: categoriasFinanceiras.nome,
    })
    .from(lancamentosFinanceiros)
    .leftJoin(
      contasBancarias,
      eq(lancamentosFinanceiros.contaBancariaId, contasBancarias.id)
    )
    .leftJoin(
      categoriasFinanceiras,
      eq(lancamentosFinanceiros.categoriaId, categoriasFinanceiras.id)
    )
    .where(eq(lancamentosFinanceiros.empresaId, empresaId))
    .orderBy(desc(lancamentosFinanceiros.data), desc(lancamentosFinanceiros.id))
    .limit(200);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos Financeiros</h1>
          <p className="text-muted-foreground">
            Movimentações manuais, baixas e transferências
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/financeiro/lancamentos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Lançamento
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/financeiro/transferencias">Transferência</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/financeiro">Voltar</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado
                  </TableCell>
                </TableRow>
              )}
              {lancamentos.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.data)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        l.tipo === "ENTRADA"
                          ? "bg-green-100 text-green-800"
                          : l.tipo === "SAIDA"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }
                    >
                      {l.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <div className="truncate font-medium">{l.descricao}</div>
                    {l.participante && (
                      <div className="text-xs text-muted-foreground truncate">
                        {l.participante}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{l.contaNome || "-"}</TableCell>
                  <TableCell>{l.categoriaNome || "-"}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      l.tipo === "ENTRADA"
                        ? "text-green-600"
                        : l.tipo === "SAIDA"
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {formatCurrency(l.valor)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(l.status || "CONFIRMADO")} variant="secondary">
                      {statusLabel(l.status || "CONFIRMADO")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.origem}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
