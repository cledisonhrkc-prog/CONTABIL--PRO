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

type Resultado = {
  saldo_salario: string;
  aviso_previo_indenizado: string;
  ferias_proporcionais: string;
  terco_ferias_proporcionais: string;
  decimo_terceiro_proporcional: string;
  multa_fgts: string;
  valor_inss: string;
  valor_irrf: string;
  total_proventos: string;
  total_descontos: string;
  total_liquido: string;
};

export default function CalcularRescisaoPage() {
  const router = useRouter();
  const params = useParams();
  const colaboradorId = params.id as string;
  const vinculoId = params.vinculoId as string;

  const [dataDemissao, setDataDemissao] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("SEM_JUSTA_CAUSA");
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");

  async function calcular() {
    if (!confirm("Isso vai encerrar o vínculo e calcular a rescisão. Confirma?")) return;
    setCalculando(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/rescisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinculoId: Number(vinculoId), dataDemissao, motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao calcular rescisão");
      setResultado(data);
    } catch (e: any) {
      setErro(e.message || "Erro ao calcular rescisão.");
    } finally {
      setCalculando(false);
    }
  }

  const fmt = (v: string) => Number(v).toFixed(2);

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dp/colaboradores/${colaboradorId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Calcular Rescisão</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da rescisão</CardTitle>
        </CardHeader>
        <CardContent>
          {!resultado ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Data da demissão</Label>
                <Input type="date" value={dataDemissao} onChange={(e) => setDataDemissao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEM_JUSTA_CAUSA">Dispensa sem justa causa</SelectItem>
                    <SelectItem value="COM_JUSTA_CAUSA">Dispensa com justa causa</SelectItem>
                    <SelectItem value="PEDIDO_DEMISSAO">Pedido de demissão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                INSS e IRRF calculados separadamente por verba (saldo, férias, 13º), aviso prévio
                indenizado isento — mesma metodologia usada por sistemas de folha profissionais.
                Ao confirmar, o vínculo é encerrado automaticamente.
              </p>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <Button onClick={calcular} disabled={calculando} className="w-full">
                {calculando ? "Calculando..." : "Calcular e encerrar vínculo"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Saldo de salário</span><span>R$ {fmt(resultado.saldo_salario)}</span></div>
              <div className="flex justify-between"><span>Aviso prévio (isento)</span><span>R$ {fmt(resultado.aviso_previo_indenizado)}</span></div>
              <div className="flex justify-between"><span>Férias proporcionais</span><span>R$ {fmt(resultado.ferias_proporcionais)}</span></div>
              <div className="flex justify-between"><span>1/3 de férias</span><span>R$ {fmt(resultado.terco_ferias_proporcionais)}</span></div>
              <div className="flex justify-between"><span>13º proporcional</span><span>R$ {fmt(resultado.decimo_terceiro_proporcional)}</span></div>
              <div className="flex justify-between"><span>Multa FGTS (isenta)</span><span>R$ {fmt(resultado.multa_fgts)}</span></div>
              <div className="flex justify-between font-medium border-t pt-2"><span>Total proventos</span><span>R$ {fmt(resultado.total_proventos)}</span></div>
              <div className="flex justify-between text-red-600"><span>INSS</span><span>R$ {fmt(resultado.valor_inss)}</span></div>
              <div className="flex justify-between text-red-600"><span>IRRF</span><span>R$ {fmt(resultado.valor_irrf)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Líquido</span><span>R$ {fmt(resultado.total_liquido)}</span></div>
              <Button variant="outline" className="w-full mt-4" onClick={() => router.push("/dp/rescisoes")}>
                Ver todas as rescisões
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
