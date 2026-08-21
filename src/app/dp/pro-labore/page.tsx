"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Pagamento = {
  id: number;
  competencia: string;
  colaborador_nome: string;
  valor_bruto: string;
  valor_inss: string;
  valor_irrf: string;
  valor_liquido: string;
  status: string;
  data_pagamento: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  PAGO: "default",
  PENDENTE: "secondary",
  CANCELADO: "destructive",
};

export default function ProLaborePage() {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [filtroCompetencia, setFiltroCompetencia] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCompetencia]);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroCompetencia) params.set("competencia", filtroCompetencia);
      const res = await fetch(`/api/dp/pro-labore?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
      setPagamentos(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar pró-labore.");
    } finally {
      setLoading(false);
    }
  }

  async function marcarPago(id: number) {
    setProcessandoId(id);
    try {
      const res = await fetch(`/api/dp/pro-labore/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataPagamento: new Date().toISOString().slice(0, 10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao marcar como pago");
      await load();
    } catch (e: any) {
      alert(e.message || "Erro ao marcar como pago.");
    } finally {
      setProcessandoId(null);
    }
  }

  async function cancelar(id: number) {
    const motivo = prompt("Motivo do cancelamento (opcional):") || undefined;
    setProcessandoId(id);
    try {
      const res = await fetch(`/api/dp/pro-labore/${id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cancelar");
      await load();
    } catch (e: any) {
      alert(e.message || "Erro ao cancelar pagamento.");
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pró-labore</h1>
          <p className="text-muted-foreground">Pagamentos por competência</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/dp">← Voltar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dp/pro-labore/resumo">Resumo</Link>
          </Button>
          <Button asChild>
            <Link href="/dp/pro-labore/novo">+ Novo pagamento</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Filtrar por competência:</label>
        <input
          type="month"
          className="border rounded-md px-2 py-1 text-sm"
          value={filtroCompetencia}
          onChange={(e) => setFiltroCompetencia(e.target.value)}
        />
        {filtroCompetencia && (
          <Button size="sm" variant="ghost" onClick={() => setFiltroCompetencia("")}>
            Limpar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {erro ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-amber-700 bg-amber-50">
                    {erro}
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : pagamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhum pagamento registrado.
                  </TableCell>
                </TableRow>
              ) : (
                pagamentos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.competencia}</TableCell>
                    <TableCell>{p.colaborador_nome}</TableCell>
                    <TableCell className="text-right">R$ {Number(p.valor_bruto).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(p.valor_inss).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(p.valor_liquido).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status] || "secondary"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/api/dp/pdf?tipo=prolabore&id=${p.id}`} target="_blank" rel="noopener noreferrer">
                            PDF
                          </a>
                        </Button>
                        {p.status === "PENDENTE" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processandoId === p.id}
                              onClick={() => marcarPago(p.id)}
                            >
                              {processandoId === p.id ? "..." : "Marcar pago"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={processandoId === p.id}
                              onClick={() => cancelar(p.id)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
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
