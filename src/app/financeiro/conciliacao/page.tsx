import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listarContasBancarias, calcularSaldoConta } from "@/lib/financeiro";
import { formatCurrency } from "@/lib/format";
import { Upload, CheckCircle2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth-financeiro";

// Página mostra dado por empresa/sessão logada — nunca pode ser estática
export const dynamic = "force-dynamic";

export default async function ConciliacaoPage() {
  const { empresaId } = await getAuthContext();
  const contas = await listarContasBancarias(empresaId);

  const contasComSaldo = await Promise.all(
    contas.map(async (c) => ({
      ...c,
      saldo: await calcularSaldoConta(empresaId, c.id),
    }))
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliação Bancária</h1>
          <p className="text-muted-foreground">
            Importe extratos (OFX/CSV) e concilie com os lançamentos do sistema
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/financeiro">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Selecione a conta bancária</p>
          <p>2. Importe o arquivo de extrato (OFX ou CSV do seu banco)</p>
          <p>3. O sistema identifica automaticamente possíveis matches com lançamentos</p>
          <p>4. Confirme ou crie novos lançamentos para itens não encontrados</p>
          <p>5. Finalize a conciliação quando o saldo bater</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contasComSaldo.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: c.cor || "#3B82F6" }}
                />
                {c.nome}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xl font-bold">{formatCurrency(c.saldo)}</div>
              <div className="flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/financeiro/conciliacao/importar?conta=${c.id}`}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Extrato
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {contasComSaldo.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Cadastre uma conta bancária primeiro
            </p>
            <Button asChild>
              <Link href="/financeiro/contas-bancarias/nova">
                Cadastrar Conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
