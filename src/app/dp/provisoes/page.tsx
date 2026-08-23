"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PiggyBank, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type VinculoCLT = { id: number; colaborador_nome: string };
type Provisao = {
  id: number;
  colaborador_nome: string;
  competencia: string;
  valor_provisao_ferias: string;
  valor_provisao_decimo_terceiro: string;
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ProvisoesPage() {
  const [clts, setClts] = useState<VinculoCLT[]>([]);
  const [vinculoId, setVinculoId] = useState("");
  const [competencia, setCompetencia] = useState(mesAtual());
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Provisao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dp/vinculos?tipoVinculo=CLT")
      .then((r) => r.json())
      .then((data) => setClts(Array.isArray(data) ? data : []))
      .catch(() => {});
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch("/api/dp/provisoes");
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  async function provisionar() {
    if (!vinculoId) {
      setErro("Selecione um colaborador.");
      return;
    }
    setProcessando(true);
    setErro("");
    setMensagem("");
    try {
      const res = await fetch("/api/dp/provisoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinculoId: Number(vinculoId), competencia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao provisionar");
      setMensagem(
        `Provisionado: R$ ${Number(data.valor_provisao_ferias).toFixed(2)} de férias + R$ ${Number(data.valor_provisao_decimo_terceiro).toFixed(2)} de 13º.`
      );
      await carregar();
    } catch (e: any) {
      setErro(e.message || "Erro ao provisionar.");
    } finally {
      setProcessando(false);
    }
  }

  const totalFerias = lista.reduce((s, p) => s + Number(p.valor_provisao_ferias), 0);
  const total13 = lista.reduce((s, p) => s + Number(p.valor_provisao_decimo_terceiro), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Provisão de Férias e 13º</h1>
          <p className="text-muted-foreground">
            Valor acumulado que a empresa já "deve" de férias e 13º — 1/12 do direito por mês trabalhado
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dp">← Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Colaborador</label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={vinculoId}
                onChange={(e) => setVinculoId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {clts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.colaborador_nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Competência</label>
              <input
                type="month"
                className="w-full border rounded-md p-2 text-sm"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {mensagem && <p className="text-sm text-green-700">{mensagem}</p>}
          <Button onClick={provisionar} disabled={processando}>
            {processando ? "Processando..." : "Provisionar este mês"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total provisionado — Férias</p>
              <p className="text-xl font-bold">R$ {totalFerias.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-violet-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total provisionado — 13º</p>
              <p className="text-xl font-bold">R$ {total13.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Competência</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3 text-right">Férias</th>
                <th className="p-3 text-right">13º</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma provisão registrada ainda.</td></tr>
              ) : (
                lista.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-3">{p.competencia}</td>
                    <td className="p-3">{p.colaborador_nome}</td>
                    <td className="p-3 text-right">R$ {Number(p.valor_provisao_ferias).toFixed(2)}</td>
                    <td className="p-3 text-right">R$ {Number(p.valor_provisao_decimo_terceiro).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
