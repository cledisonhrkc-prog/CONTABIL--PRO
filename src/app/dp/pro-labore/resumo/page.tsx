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
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type Resumo = {
  colaborador_id: number;
  nome_completo: string;
  competencia: string;
  total_bruto: string;
  total_inss: string;
  total_irrf: string;
  total_liquido: string;
  qtd_pagamentos: string;
  qtd_pagos: string;
  qtd_pendentes: string;
};

export default function ResumoProLaborePage() {
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const res = await fetch("/api/dp/pro-labore/resumo");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
        setResumo(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar resumo.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dp/pro-labore">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Resumo de Pró-labore</h1>
          <p className="text-muted-foreground">Total por sócio e competência (não inclui cancelados)</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Sócio</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">IRRF</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-center">Pagos / Pendentes</TableHead>
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
              ) : resumo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhum pagamento registrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                resumo.map((r, idx) => (
                  <TableRow key={`${r.colaborador_id}-${r.competencia}-${idx}`}>
                    <TableCell>{r.competencia}</TableCell>
                    <TableCell>{r.nome_completo}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.total_bruto).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.total_inss).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.total_irrf).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(r.total_liquido).toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">{r.qtd_pagos} pagos</Badge>{" "}
                      {Number(r.qtd_pendentes) > 0 && (
                        <Badge variant="secondary">{r.qtd_pendentes} pendentes</Badge>
                      )}
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
