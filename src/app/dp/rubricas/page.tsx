"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

type Rubrica = {
  id: number;
  codigo: string;
  nome: string;
  tipo: "PROVENTO" | "DESCONTO";
  valor_fixo: string;
  is_ativo: boolean;
};

export default function RubricasPage() {
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [novaRubrica, setNovaRubrica] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"PROVENTO" | "DESCONTO">("DESCONTO");
  const [valorFixo, setValorFixo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/dp/rubricas");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
      setRubricas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar rubricas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function salvar() {
    if (!codigo || !nome || !valorFixo) {
      setErroForm("Preencha código, nome e valor.");
      return;
    }
    setSalvando(true);
    setErroForm("");
    try {
      const res = await fetch("/api/dp/rubricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nome, tipo, valorFixo: Number(valorFixo) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao criar rubrica");
      setNovaRubrica(false);
      setCodigo("");
      setNome("");
      setValorFixo("");
      setTipo("DESCONTO");
      await load();
    } catch (e: any) {
      setErroForm(e.message || "Erro ao criar rubrica.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rubricas</h1>
          <p className="text-muted-foreground">Proventos e descontos usados na folha CLT</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/dp">← Voltar</Link>
          </Button>
          {!novaRubrica && (
            <Button onClick={() => setNovaRubrica(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova rubrica
            </Button>
          )}
        </div>
      </div>

      {novaRubrica && (
        <Card>
          <CardHeader>
            <CardTitle>Nova rubrica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ex: VT" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as "PROVENTO" | "DESCONTO")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROVENTO">Provento</SelectItem>
                    <SelectItem value="DESCONTO">Desconto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Vale-transporte" />
            </div>
            <div className="space-y-2">
              <Label>Valor fixo (R$)</Label>
              <Input type="number" step="0.01" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} />
            </div>
            {erroForm && <p className="text-sm text-red-600">{erroForm}</p>}
            <div className="flex gap-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => setNovaRubrica(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          {erro ? (
            <p className="text-amber-700">{erro}</p>
          ) : loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : rubricas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma rubrica cadastrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {rubricas.map((r) => (
                <div key={r.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <span className="font-medium">{r.nome}</span>
                    <span className="text-muted-foreground text-sm ml-2">({r.codigo})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={r.tipo === "PROVENTO" ? "default" : "secondary"}>{r.tipo}</Badge>
                    <span className="font-medium">R$ {Number(r.valor_fixo).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
