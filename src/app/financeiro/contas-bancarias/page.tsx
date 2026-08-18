import { listarContasBancarias, calcularSaldoConta } from "@/lib/financeiro";
import { formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth-financeiro";

// Página mostra dado por empresa/sessão logada — nunca pode ser estática
export const dynamic = "force-dynamic";

export default async function ContasBancariasPage() {
  const { empresaId } = await getAuthContext();
  const contas = await listarContasBancarias(empresaId);

  const contasComSaldo = await Promise.all(
    contas.map(async (c) => ({
      ...c,
      saldo: await calcularSaldoConta(empresaId, c.id),
    }))
  );

  const total = contasComSaldo.reduce((acc, c) => acc + c.saldo, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground">
            Total em contas: {formatCurrency(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/financeiro/contas-bancarias/nova">
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/financeiro">Voltar</Link>
          </Button>
        </div>
      </div>

      {contasComSaldo.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhuma conta bancária cadastrada
            </p>
            <Button asChild>
              <Link href="/financeiro/contas-bancarias/nova">
                Cadastrar primeira conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contasComSaldo.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: c.cor || "#3B82F6" }}
                    />
                    {c.nome}
                  </CardTitle>
                  <Badge variant={c.ativa ? "default" : "secondary"}>
                    {c.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">
                  {formatCurrency(c.saldo)}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {c.banco && <p>Banco: {c.banco}</p>}
                  {c.agencia && (
                    <p>
                      Ag: {c.agencia} • Conta: {c.conta}
                    </p>
                  )}
                  <p>Tipo: {c.tipo}</p>
                  {c.dataSaldoInicial && (
                    <p>Saldo inicial em {formatDate(c.dataSaldoInicial)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
