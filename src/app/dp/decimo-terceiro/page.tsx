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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

type VinculoCLT = { id: number; colaborador_nome: string };
type Decimo = {
  id: number;
  colaborador_nome: string;
  ano: number;
  parcela: number;
  valor_parcela: string;
  valor_inss: string;
  valor_irrf: string;
  valor_liquido: string;
  status: string;
};

export default function DecimoTerceiroPage() {
  const [clts, setClts] = useState<VinculoCLT[]>([]);
  const [lista, setLista] = useState<Decimo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);

  const [vinculoId, setVinculoId] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [parcela, setParcela] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dp/decimo-terceiro");
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/dp/vinculos?tipoVinculo=CLT")
      .then((r) => r.json())
      .then((data) => setClts(Array.isArray(data) ? data : []))
      .catch(() => {});
    load();
  }, []);

  async function salvar() {
    if (!vinculoId || !ano || !parcela) {
      setErro("Preencha colaborador, ano e parcela.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/decimo-terceiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinculoId: Number(vinculoId), ano: Number(ano), parcela: Number(parcela) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao calcular 13º");
      setNova(false);
      setVinculoId("");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao calcular 13º.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">13º Salário</h1>
          <p className="text-muted-foreground">1ª e 2ª parcela — CLT</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/dp">← Voltar</Link>
          </Button>
          {!nova && (
            <Button onClick={() => setNova(true)}>
              <Plus className="h-4 w-4 mr-1" /> Calcular
            </Button>
          )}
        </div>
      </div>

      {nova && (
        <Card>
          <CardHeader>
            <CardTitle>Calcular 13º</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={vinculoId} onValueChange={setVinculoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {clts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.colaborador_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Parcela</Label>
                <Select value={parcela} onValueChange={setParcela}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1ª parcela (50%, sem desconto)</SelectItem>
                    <SelectItem value="2">2ª parcela (com INSS/IRRF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? "Calculando..." : "Calcular e salvar"}
              </Button>
              <Button variant="outline" onClick={() => setNova(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead className="text-right">Valor da parcela</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">IRRF</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : lista.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum 13º calculado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.colaborador_nome}</TableCell>
                    <TableCell>{d.ano}</TableCell>
                    <TableCell>
                      <Badge variant={d.parcela === 1 ? "secondary" : "default"}>{d.parcela}ª parcela</Badge>
                    </TableCell>
                    <TableCell className="text-right">R$ {Number(d.valor_parcela).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(d.valor_inss).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(d.valor_irrf).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(d.valor_liquido).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
