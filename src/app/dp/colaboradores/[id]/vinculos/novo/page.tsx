"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function NovoVinculoPage() {
  const router = useRouter();
  const params = useParams();
  const colaboradorId = params.id as string;

  const [tipoVinculo, setTipoVinculo] = useState("PRO_LABORE");
  const [cargo, setCargo] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
  const [valorProLabore, setValorProLabore] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: Number(colaboradorId),
          tipoVinculo,
          cargo: cargo || undefined,
          dataAdmissao,
          salarioBase: salarioBase ? Number(salarioBase) : undefined,
          valorProLabore: valorProLabore ? Number(valorProLabore) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar");
      router.push(`/dp/colaboradores/${colaboradorId}`);
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar vínculo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dp/colaboradores/${colaboradorId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Novo Vínculo</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do vínculo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de vínculo</Label>
              <Select value={tipoVinculo} onValueChange={setTipoVinculo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRO_LABORE">Pró-labore</SelectItem>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="ESTAGIO">Estágio</SelectItem>
                  <SelectItem value="AUTONOMO">Autônomo</SelectItem>
                  <SelectItem value="TEMPORARIO">Temporário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Data de admissão</Label>
              <Input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} required />
            </div>

            {tipoVinculo === "PRO_LABORE" ? (
              <div className="space-y-2">
                <Label>Valor do pró-labore (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorProLabore}
                  onChange={(e) => setValorProLabore(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Salário base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(e.target.value)}
                />
              </div>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar vínculo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
