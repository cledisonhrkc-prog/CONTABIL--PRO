"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Colaborador = { id: number; tipo_pessoa: string; nome_completo: string; is_ativo: boolean };
type ProLabore = { id: number; competencia: string; status: string; valor_liquido: string; colaborador_nome: string };

export default function DPDashboard() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [pendentes, setPendentes] = useState<ProLabore[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJson(url: string) {
      const r = await fetch(url);
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || `Erro ao carregar ${url} (${r.status})`);
      return data;
    }
    async function load() {
      try {
        const [c, p] = await Promise.all([
          fetchJson("/api/dp/colaboradores"),
          fetchJson("/api/dp/pro-labore?status=PENDENTE"),
        ]);
        setColaboradores(Array.isArray(c) ? c : []);
        setPendentes(Array.isArray(p) ? p : []);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar dados do DP.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md text-center bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-amber-800 font-medium mb-2">Não foi possível carregar o DP</p>
          <p className="text-sm text-amber-700 mb-4">{erro}</p>
          <Link href="/" className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
            Voltar e selecionar empresa
          </Link>
        </div>
      </div>
    );
  }

  const ativos = colaboradores.filter((c) => c.is_ativo);
  const socios = ativos.filter((c) => c.tipo_pessoa === "SOCIO");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departamento Pessoal</h1>
          <p className="text-muted-foreground">Colaboradores e pró-labore</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dp/colaboradores">Colaboradores</Link>
          </Button>
          <Button asChild>
            <Link href="/dp/colaboradores/novo">+ Novo Colaborador</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Colaboradores ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ativos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sócios (pró-labore)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{socios.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pró-labore pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendentes.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pró-labore pendente</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/dp/pro-labore">Ver tudo</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento pendente.</p>
          ) : (
            <div className="space-y-2">
              {pendentes.slice(0, 5).map((p) => (
                <div key={p.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{p.colaborador_nome} — {p.competencia}</span>
                  <span className="font-medium">R$ {Number(p.valor_liquido).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
