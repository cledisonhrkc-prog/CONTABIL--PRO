"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Categoria = {
  id: number;
  nome: string;
  tipo: string;
  cor: string | null;
  ativo: boolean | null;
};

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("DESPESA");
  const [cor, setCor] = useState("#6B7280");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/financeiro/categorias");
    if (res.ok) {
      const data = await res.json();
      setCategorias(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/financeiro/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, tipo, cor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setNome("");
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const receitas = categorias.filter((c) => c.tipo === "RECEITA");
  const despesas = categorias.filter((c) => c.tipo === "DESPESA");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/financeiro">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Categorias Financeiras</h1>
            <p className="text-muted-foreground">
              Organize receitas e despesas
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
              {error && (
                <div className="w-full rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  placeholder="Ex: Aluguel, Fornecedores..."
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEITA">Receita</SelectItem>
                    <SelectItem value="DESPESA">Despesa</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-16 h-10 p-1"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-muted-foreground">Carregando...</p>}
            {!loading && receitas.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhuma categoria de receita</p>
            )}
            {receitas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.cor || "#6B7280" }}
                  />
                  <span>{c.nome}</span>
                </div>
                <Badge variant="secondary">Receita</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-700">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-muted-foreground">Carregando...</p>}
            {!loading && despesas.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhuma categoria de despesa</p>
            )}
            {despesas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.cor || "#6B7280" }}
                  />
                  <span>{c.nome}</span>
                </div>
                <Badge variant="secondary">Despesa</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
