import { fluxoCaixaCompleto, calcularSaldoTotal } from "@/lib/financeiro";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth-financeiro";

// Página mostra dado por empresa/sessão logada — nunca pode ser estática
export const dynamic = "force-dynamic";

export default async function FluxoCaixaPage() {
  const { empresaId } = await getAuthContext();
  const fluxo = await fluxoCaixaCompleto(empresaId, 6);
  const { total: saldoAtual } = await calcularSaldoTotal(empresaId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">
            Saldo atual: {formatCurrency(saldoAtual)} • Projeção de 6 meses
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/financeiro">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projeção Mensal com Saldo Acumulado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-2 text-left">Mês</th>
                  <th className="py-3 px-2 text-right">Entradas Confirmadas</th>
                  <th className="py-3 px-2 text-right">Saídas Confirmadas</th>
                  <th className="py-3 px-2 text-right">Entradas Projetadas</th>
                  <th className="py-3 px-2 text-right">Saídas Projetadas</th>
                  <th className="py-3 px-2 text-right">Líquido do Mês</th>
                  <th className="py-3 px-2 text-right font-bold">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {fluxo.map((m) => {
                  const liquido =
                    m.entradasConfirmadas +
                    m.entradasProjetadas -
                    m.saidasConfirmadas -
                    m.saidasProjetadas;
                  return (
                    <tr key={m.mes} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-2 font-medium">{m.mes}</td>
                      <td className="py-3 px-2 text-right text-green-600">
                        {formatCurrency(m.entradasConfirmadas)}
                      </td>
                      <td className="py-3 px-2 text-right text-red-600">
                        {formatCurrency(m.saidasConfirmadas)}
                      </td>
                      <td className="py-3 px-2 text-right text-green-500">
                        {formatCurrency(m.entradasProjetadas)}
                      </td>
                      <td className="py-3 px-2 text-right text-red-500">
                        {formatCurrency(m.saidasProjetadas)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-medium ${
                          liquido >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(liquido)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-bold ${
                          m.saldoFinal >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(m.saldoFinal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Entradas Confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(
                fluxo.reduce((a, m) => a + m.entradasConfirmadas, 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Saídas Confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(
                fluxo.reduce((a, m) => a + m.saidasConfirmadas, 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Saldo Final Projetado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(
                fluxo[fluxo.length - 1]?.saldoFinal || saldoAtual
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
