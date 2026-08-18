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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type ContaBancaria = { id: number; nome: string };
type Categoria = { id: number; nome: string; tipo: string };

export default function NovoLancamentoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [data, setData] = useState(formatDateInput());
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [participante, setParticipante] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    async function load() {
      const [cRes, catRes] = await Promise.all([
        fetch("/api/financeiro/contas-bancarias"),
        fetch("/api/financeiro/categorias"),
      ]);
      if (cRes.ok) {
        const c = await cRes.json();
        setContas(c);
        if (c.length > 0) setContaBancariaId(String(c[0].id));
      }
      if (catRes.ok) {
        const cat = await catRes.json();
        setCategorias(cat);
      }
    }
    load();
  }, []);

  const categoriasFiltradas = categorias.filter(
    (c) => c.tipo === (tipo === "ENTRADA" ? "RECEITA" : "DESPESA")
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          data,
          valor: Number(valor),
          descricao,
          contaBancariaId: Number(contaBancariaId),
          categoriaId: categoriaId ? Number(categoriaId) : null,
          participante: participante || null,
          formaPagamento,
          observacao: observacao || null,
        }),
      });

      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error || "Erro ao criar lançamento");

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
          <Link href="/financeiro/lancamentos">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Novo Lançamento</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada (Receita)</SelectItem>
                  <SelectItem value="SAIDA">Saída (Despesa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Aluguel do mês, Taxa bancária..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Conta bancária *</Label>
              <Select value={contaBancariaId} onValueChange={setContaBancariaId} required>
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
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasFiltradas.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participante">Participante (cliente/fornecedor)</Label>
              <Input
                id="participante"
                value={participante}
                onChange={(e) => setParticipante(e.target.value)}
              />
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
                {saving ? "Salvando..." : "Salvar Lançamento"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/financeiro/lancamentos">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
