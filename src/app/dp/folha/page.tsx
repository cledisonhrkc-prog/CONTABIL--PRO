"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type VinculoCLT = { id: number; colaborador_id: number; colaborador_nome: string };
type Holerite = {
  id: number;
  competencia: string;
  colaborador_nome: string;
  salario_base: string;
  total_proventos: string;
  total_descontos: string;
  total_liquido: string;
  valor_inss: string;
  valor_irrf: string;
  fgts_mes: string;
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ProcessarFolhaPage() {
  const [clts, setClts] = useState<VinculoCLT[]>([]);
  const [vinculoId, setVinculoId] = useState("");
  const [competencia, setCompetencia] = useState(mesAtual());
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [holerites, setHolerites] = useState<Holerite[]>([]);
  const [loadingHolerites, setLoadingHolerites] = useState(true);

  useEffect(() => {
    fetch("/api/dp/vinculos?tipoVinculo=CLT")
      .then((r) => r.json())
      .then((data) => setClts(Array.isArray(data) ? data : []))
      .catch(() => {});
    carregarHolerites();
  }, []);

  async function carregarHolerites() {
    setLoadingHolerites(true);
    try {
      const res = await fetch("/api/dp/folha/holerites");
      const data = await res.json();
      setHolerites(Array.isArray(data) ? data : []);
    } catch {
      // silencioso, não é crítico
    } finally {
      setLoadingHolerites(false);
    }
  }

  async function processarIndividual() {
    if (!vinculoId) {
      setErro("Selecione um colaborador.");
      return;
    }
    const v = clts.find((c) => String(c.id) === vinculoId);
    if (!v) return;
    setProcessando(true);
    setErro("");
    setMensagem("");
    try {
      const res = await fetch("/api/dp/folha/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaboradorId: v.colaborador_id, competencia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao processar");
      setMensagem(`Folha de ${v.colaborador_nome} processada — líquido R$ ${Number(data.total_liquido).toFixed(2)}.`);
      await carregarHolerites();
    } catch (e: any) {
      setErro(e.message || "Erro ao processar folha.");
    } finally {
      setProcessando(false);
    }
  }

  async function processarLote() {
    if (!confirm(`Processar a folha de TODOS os CLT ativos para ${competencia}?`)) return;
    setProcessando(true);
    setErro("");
    setMensagem("");
    try {
      const res = await fetch("/api/dp/folha/processar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao processar em lote");
      setMensagem(
        `Lote processado: ${data.processados} de ${data.totalClt} colaboradores.` +
          (data.erros?.length > 0 ? ` ${data.erros.length} com erro.` : "")
      );
      await carregarHolerites();
    } catch (e: any) {
      setErro(e.message || "Erro ao processar em lote.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Processar Folha</h1>
          <p className="text-muted-foreground">Folha de pagamento CLT — individual ou em lote</p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dp">← Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo processamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Colaborador (só pra processamento individual)</Label>
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
          </div>

          {clts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum colaborador CLT ativo cadastrado ainda.</p>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {mensagem && <p className="text-sm text-green-700">{mensagem}</p>}

          <div className="flex gap-2">
            <Button onClick={processarIndividual} disabled={processando || !vinculoId}>
              {processando ? "Processando..." : "Processar individual"}
            </Button>
            <Button onClick={processarLote} disabled={processando || clts.length === 0} variant="outline">
              {processando ? "Processando..." : "Processar todos (lote)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holerites processados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Salário</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">IRRF</TableHead>
                <TableHead className="text-right">FGTS</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHolerites ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : holerites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum holerite processado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                holerites.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.competencia}</TableCell>
                    <TableCell>{h.colaborador_nome}</TableCell>
                    <TableCell className="text-right">R$ {Number(h.salario_base).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(h.valor_inss).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(h.valor_irrf).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(h.fgts_mes).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(h.total_liquido).toFixed(2)}</TableCell>
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
