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
type Ferias = {
  id: number;
  colaborador_nome: string;
  data_inicio_gozo: string;
  data_fim_gozo: string;
  dias_gozo: number;
  abono_pecuniario: boolean;
  total_bruto: string;
  total_liquido: string;
  status: string;
};

export default function FeriasPage() {
  const [clts, setClts] = useState<VinculoCLT[]>([]);
  const [lista, setLista] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);
  const [nova, setNova] = useState(false);

  const [vinculoId, setVinculoId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [dataInicioGozo, setDataInicioGozo] = useState("");
  const [dataFimGozo, setDataFimGozo] = useState("");
  const [diasGozo, setDiasGozo] = useState("30");
  const [abono, setAbono] = useState(false);
  const [diasAbono, setDiasAbono] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dp/ferias");
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
    if (!vinculoId || !periodoInicio || !periodoFim || !dataInicioGozo || !dataFimGozo || !diasGozo) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/ferias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vinculoId: Number(vinculoId),
          periodoAquisitivoInicio: periodoInicio,
          periodoAquisitivoFim: periodoFim,
          dataInicioGozo,
          dataFimGozo,
          diasGozo: Number(diasGozo),
          abonoPecuniario: abono,
          diasAbono: abono ? Number(diasAbono) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao calcular férias");
      setNova(false);
      setVinculoId("");
      setPeriodoInicio("");
      setPeriodoFim("");
      setDataInicioGozo("");
      setDataFimGozo("");
      setDiasGozo("30");
      setAbono(false);
      setDiasAbono("0");
      await load();
    } catch (e: any) {
      setErro(e.message || "Erro ao calcular férias.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Férias</h1>
          <p className="text-muted-foreground">Programação e cálculo de férias CLT</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/dp">← Voltar</Link>
          </Button>
          {!nova && (
            <Button onClick={() => setNova(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          )}
        </div>
      </div>

      {nova && (
        <Card>
          <CardHeader>
            <CardTitle>Calcular férias</CardTitle>
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
                <Label>Período aquisitivo — início</Label>
                <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Período aquisitivo — fim</Label>
                <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início do gozo</Label>
                <Input type="date" value={dataInicioGozo} onChange={(e) => setDataInicioGozo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim do gozo</Label>
                <Input type="date" value={dataFimGozo} onChange={(e) => setDataFimGozo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias de gozo</Label>
              <Input type="number" min="1" max="30" value={diasGozo} onChange={(e) => setDiasGozo(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="abono" checked={abono} onChange={(e) => setAbono(e.target.checked)} />
              <label htmlFor="abono" className="text-sm cursor-pointer">
                Vender parte das férias (abono pecuniário, isento de INSS/IRRF)
              </label>
            </div>
            {abono && (
              <div className="space-y-2">
                <Label>Dias vendidos (até 10)</Label>
                <Input type="number" min="0" max="10" value={diasAbono} onChange={(e) => setDiasAbono(e.target.value)} />
              </div>
            )}
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
                <TableHead>Gozo</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Abono</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : lista.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma férias calculada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.colaborador_nome}</TableCell>
                    <TableCell>
                      {new Date(f.data_inicio_gozo).toLocaleDateString("pt-BR")} - {new Date(f.data_fim_gozo).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{f.dias_gozo}</TableCell>
                    <TableCell>{f.abono_pecuniario ? <Badge variant="secondary">Sim</Badge> : "—"}</TableCell>
                    <TableCell className="text-right">R$ {Number(f.total_bruto).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(f.total_liquido).toFixed(2)}</TableCell>
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
