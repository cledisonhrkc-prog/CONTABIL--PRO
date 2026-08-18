"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateInput } from "@/lib/format";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NovaContaBancariaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipo, setTipo] = useState("CORRENTE");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [dataSaldoInicial, setDataSaldoInicial] = useState(formatDateInput());
  const [cor, setCor] = useState("#3B82F6");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/financeiro/contas-bancarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          banco,
          agencia,
          conta,
          tipo,
          saldoInicial: Number(saldoInicial),
          dataSaldoInicial,
          cor,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");

      router.push("/financeiro/contas-bancarias");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/financeiro/contas-bancarias">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Nova Conta Bancária</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nome">Nome da conta *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Itaú CC Principal"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="Ex: 341 - Itaú"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORRENTE">Conta Corrente</SelectItem>
                    <SelectItem value="POUPANCA">Poupança</SelectItem>
                    <SelectItem value="INVESTIMENTO">Investimento</SelectItem>
                    <SelectItem value="CAIXA">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agencia">Agência</Label>
                <Input
                  id="agencia"
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conta">Número da conta</Label>
                <Input
                  id="conta"
                  value={conta}
                  onChange={(e) => setConta(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="saldo">Saldo inicial</Label>
                <Input
                  id="saldo"
                  type="number"
                  step="0.01"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataSaldo">Data do saldo inicial</Label>
                <Input
                  id="dataSaldo"
                  type="date"
                  value={dataSaldoInicial}
                  onChange={(e) => setDataSaldoInicial(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cor">Cor de identificação</Label>
              <div className="flex gap-2">
                <Input
                  id="cor"
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input value={cor} onChange={(e) => setCor(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Salvando..." : "Criar Conta"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/financeiro/contas-bancarias">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
