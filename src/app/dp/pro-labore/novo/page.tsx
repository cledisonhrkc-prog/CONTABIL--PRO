"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type VinculoOpcao = { id: number; colaborador_nome: string; valor_pro_labore: string };

export default function NovoPagamentoProLaborePage() {
  const router = useRouter();
  const [vinculos, setVinculos] = useState<VinculoOpcao[]>([]);
  const [vinculoId, setVinculoId] = useState<string>("");
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));
  const [valorBruto, setValorBruto] = useState("");
  const [valorInss, setValorInss] = useState("");
  const [valorIrrf, setValorIrrf] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [carregandoVinculos, setCarregandoVinculos] = useState(true);

  useEffect(() => {
    fetch("/api/dp/vinculos?tipoVinculo=PRO_LABORE")
      .then((r) => r.json())
      .then((data) => setVinculos(Array.isArray(data) ? data : []))
      .catch(() => setErro("Erro ao carregar sócios com pró-labore."))
      .finally(() => setCarregandoVinculos(false));
  }, []);

  function selecionarVinculo(id: string) {
    setVinculoId(id);
    const v = vinculos.find((x) => String(x.id) === id);
    if (v?.valor_pro_labore) setValorBruto(v.valor_pro_labore);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/pro-labore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vinculoId: Number(vinculoId),
          competencia,
          valorBruto: Number(valorBruto),
          valorInss: valorInss ? Number(valorInss) : undefined,
          valorIrrf: valorIrrf ? Number(valorIrrf) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar");
      router.push("/dp/pro-labore");
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dp/pro-labore">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Novo Pagamento de Pró-labore</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          {!carregandoVinculos && vinculos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum sócio com vínculo de pró-labore cadastrado ainda.{" "}
              <Link href="/dp/colaboradores/novo" className="underline">
                Cadastre um colaborador
              </Link>{" "}
              e adicione um vínculo do tipo Pró-labore antes de lançar um pagamento.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Sócio</Label>
                <Select value={vinculoId} onValueChange={selecionarVinculo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vinculos.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.colaborador_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Competência</Label>
                <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Valor bruto (R$)</Label>
                <Input type="number" step="0.01" value={valorBruto} onChange={(e) => setValorBruto(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>INSS (R$) — informe o valor já calculado</Label>
                <Input type="number" step="0.01" value={valorInss} onChange={(e) => setValorInss(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>IRRF (R$) — informe o valor já calculado</Label>
                <Input type="number" step="0.01" value={valorIrrf} onChange={(e) => setValorIrrf(e.target.value)} />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <Button type="submit" disabled={saving || !vinculoId} className="w-full">
                {saving ? "Salvando..." : "Registrar pagamento"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
