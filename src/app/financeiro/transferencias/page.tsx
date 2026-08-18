"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import Link from "next/link";

type ContaBancaria = { id: number; nome: string };

export default function TransferenciasPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contas, setContas] = useState<ContaBancaria[]>([]);

  const [data, setData] = useState(formatDateInput());
  const [valor, setValor] = useState("");
  const [contaOrigemId, setContaOrigemId] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/financeiro/contas-bancarias");
      if (res.ok) {
        const c = await res.json();
        setContas(c);
        if (c.length >= 2) {
          setContaOrigemId(String(c[0].id));
          setContaDestinoId(String(c[1].id));
        } else if (c.length === 1) {
          setContaOrigemId(String(c[0].id));
        }
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/financeiro/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          valor: Number(valor),
          contaOrigemId: Number(contaOrigemId),
          contaDestinoId: Number(contaDestinoId),
          descricao: descricao || undefined,
          observacao: observacao || undefined,
        }),
      });

      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error || "Erro na transferência");

      router.push("/financeiro/lancamentos");
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
          <Link href="/financeiro">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" />
            Transferência entre Contas
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Transferência</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Conta de origem *</Label>
              <Select value={contaOrigemId} onValueChange={setContaOrigemId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta de destino *</Label>
              <Select value={contaDestinoId} onValueChange={setContaDestinoId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas
                    .filter((c) => String(c.id) !== contaOrigemId)
                    .map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Opcional - será gerada automaticamente"
              />
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
              <Button
                type="submit"
                disabled={saving || !contaOrigemId || !contaDestinoId}
                className="flex-1"
              >
                {saving ? "Processando..." : "Confirmar Transferência"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/financeiro">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
