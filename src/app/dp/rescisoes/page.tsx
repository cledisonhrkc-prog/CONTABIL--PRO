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

type Rescisao = {
  id: number;
  colaborador_nome: string;
  data_demissao: string;
  motivo: string;
  total_proventos: string;
  total_descontos: string;
  total_liquido: string;
  status: string;
};

const MOTIVO_LABEL: Record<string, string> = {
  SEM_JUSTA_CAUSA: "Sem justa causa",
  COM_JUSTA_CAUSA: "Com justa causa",
  PEDIDO_DEMISSAO: "Pedido de demissão",
};

export default function RescisoesPage() {
  const [rescisoes, setRescisoes] = useState<Rescisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const res = await fetch("/api/dp/rescisao");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
        setRescisoes(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar rescisões.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rescisões</h1>
          <p className="text-muted-foreground">
            INSS/IRRF calculados separadamente por verba (saldo, férias, 13º) — aviso prévio isento
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dp">← Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Demissão</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Proventos</TableHead>
                <TableHead className="text-right">Descontos</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {erro ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-amber-700 bg-amber-50">
                    {erro}
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rescisoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Nenhuma rescisão calculada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rescisoes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.colaborador_nome}</TableCell>
                    <TableCell>{new Date(r.data_demissao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{MOTIVO_LABEL[r.motivo] || r.motivo}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.total_proventos).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.total_descontos).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(r.total_liquido).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`/api/dp/pdf?tipo=rescisao&id=${r.id}`} target="_blank" rel="noopener noreferrer">
                          PDF
                        </a>
                      </Button>
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
