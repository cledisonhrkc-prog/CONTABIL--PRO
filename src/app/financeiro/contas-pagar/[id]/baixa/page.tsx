"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Conta = {
  id: number;
  participante: string;
  descricao: string | null;
  valor: string;
  valorPago: string | null;
  status: string;
  vencimento: string;
};

type ContaBancaria = {
  id: number;
  nome: string;
};

export default function BaixaPagarPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [conta, setConta] = useState<Conta | null>(null);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [valor, setValor] = useState("");
  const [dataBaixa, setDataBaixa] = useState(formatDateInput());
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/financeiro/contas-pagar/${id}`);
        if (!res.ok) throw new Error("Conta não encontrada");
        const data = await res.json();
        setConta(data.conta);
        setContasBancarias(data.contasBancarias || []);
        const saldo =
          Number(data.conta.valor) - Number(data.conta.valorPago || 0);
        setValor(saldo.toFixed(2));
        if (data.contasBancarias?.length > 0) {
          setContaBancariaId(String(data.contasBancarias[0].id));
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/financeiro/baixas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "PAGAR",
          contaId: id,
          valor: Number(valor),
          dataBaixa,
          contaBancariaId: Number(contaBancariaId),
          formaPagamento,
          observacao,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao baixar");

      router.push("/financeiro/contas-pagar");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!conta) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || "Conta não encontrada"}</p>
        <Button asChild className="mt-4">
          <Link href="/financeiro/contas-pagar">Voltar</Link>
        </Button>
      </div>
    );
  }

  const saldo = Number(conta.valor) - Number(conta.valorPago || 0);

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/financeiro/contas-pagar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Baixa de Pagamento</h1>
          <p className="text-muted-foreground">{conta.participante}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor original</span>
            <span>{formatCurrency(conta.valor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Já pago</span>
            <span>{formatCurrency(conta.valorPago || 0)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Saldo restante</span>
            <span className="text-red-600">{formatCurrency(saldo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vencimento</span>
            <span>{formatDate(conta.vencimento)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Baixa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="valor">Valor a pagar *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0.01"
                max={saldo}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Máximo: {formatCurrency(saldo)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataBaixa">Data do pagamento *</Label>
              <Input
                id="dataBaixa"
                type="date"
                value={dataBaixa}
                onChange={(e) => setDataBaixa(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Conta bancária *</Label>
              <Select value={contaBancariaId} onValueChange={setContaBancariaId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TED">TED</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observação</Label>
              <Textarea
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving || !contaBancariaId} className="flex-1">
                {saving ? "Processando..." : "Confirmar Baixa"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/financeiro/contas-pagar">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
