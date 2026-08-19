"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

type Vinculo = {
  id: number;
  tipo_vinculo: string;
  cargo: string | null;
  data_admissao: string;
  salario_base: string;
  valor_pro_labore: string | null;
  is_ativo: boolean;
};

type ColaboradorDetalhe = {
  id: number;
  tipo_pessoa: string;
  cpf: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  is_ativo: boolean;
  vinculos: Vinculo[];
};

const TIPO_VINCULO_LABEL: Record<string, string> = {
  CLT: "CLT",
  PRO_LABORE: "Pró-labore",
  ESTAGIO: "Estágio",
  AUTONOMO: "Autônomo",
  TEMPORARIO: "Temporário",
};

export default function ColaboradorDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const [colaborador, setColaborador] = useState<ColaboradorDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const res = await fetch(`/api/dp/colaboradores/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
        setColaborador(data);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar colaborador.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (erro || !colaborador) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md text-center bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-amber-800 font-medium mb-2">Não foi possível carregar</p>
          <p className="text-sm text-amber-700 mb-4">{erro}</p>
          <Link href="/dp/colaboradores" className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dp/colaboradores">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{colaborador.nome_completo}</h1>
          <p className="text-sm text-muted-foreground">
            {colaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
          </p>
        </div>
        <Badge variant={colaborador.is_ativo ? "default" : "secondary"} className="ml-auto">
          {colaborador.is_ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contato</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>E-mail: {colaborador.email || "—"}</p>
          <p>Telefone: {colaborador.telefone || "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vínculos</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dp/colaboradores/${id}/vinculos/novo`}>
              <Plus className="h-4 w-4 mr-1" /> Novo vínculo
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {colaborador.vinculos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vínculo cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {colaborador.vinculos.map((v) => (
                <div key={v.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{TIPO_VINCULO_LABEL[v.tipo_vinculo] || v.tipo_vinculo}</span>
                    <Badge variant={v.is_ativo ? "default" : "secondary"}>
                      {v.is_ativo ? "Ativo" : "Encerrado"}
                    </Badge>
                  </div>
                  {v.cargo && <p className="text-muted-foreground">{v.cargo}</p>}
                  <p className="text-muted-foreground">
                    Admissão: {new Date(v.data_admissao).toLocaleDateString("pt-BR")}
                  </p>
                  <p>
                    {v.tipo_vinculo === "PRO_LABORE"
                      ? `Pró-labore: R$ ${Number(v.valor_pro_labore).toFixed(2)}`
                      : `Salário: R$ ${Number(v.salario_base).toFixed(2)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
