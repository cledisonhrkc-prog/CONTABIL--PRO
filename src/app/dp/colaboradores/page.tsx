"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Colaborador = {
  id: number;
  tipo_pessoa: string;
  cpf: string;
  nome_completo: string;
  email: string | null;
  is_ativo: boolean;
};

const TIPO_LABEL: Record<string, string> = {
  FUNCIONARIO: "Funcionário",
  SOCIO: "Sócio",
  ESTAGIARIO: "Estagiário",
  AUTONOMO: "Autônomo",
};

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [busca]);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      const res = await fetch(`/api/dp/colaboradores?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
      setColaboradores(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground">Funcionários, sócios e estagiários</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/dp">← Voltar</Link>
          </Button>
          <Button asChild>
            <Link href="/dp/colaboradores/novo">+ Novo</Link>
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar por nome ou CPF..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {erro ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-amber-700 bg-amber-50">
                    {erro}
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : colaboradores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                colaboradores.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/dp/colaboradores/${c.id}`} className="font-medium hover:underline">
                        {c.nome_completo}
                      </Link>
                    </TableCell>
                    <TableCell>{formatCpf(c.cpf)}</TableCell>
                    <TableCell>{TIPO_LABEL[c.tipo_pessoa] || c.tipo_pessoa}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_ativo ? "default" : "secondary"}>
                        {c.is_ativo ? "Ativo" : "Inativo"}
                      </Badge>
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
