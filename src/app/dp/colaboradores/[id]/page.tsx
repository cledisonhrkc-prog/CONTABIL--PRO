"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import DadosComplementares from "@/components/dp/DadosComplementares";

export const dynamic = "force-dynamic";

type Vinculo = {
  id: number;
  tipo_vinculo: string;
  cargo: string | null;
  data_admissao: string;
  data_demissao: string | null;
  salario_base: string;
  valor_pro_labore: string | null;
  is_ativo: boolean;
};

type Endereco = {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
} | null;

type ContaBancaria = {
  id: number;
  banco_codigo: string;
  banco_nome: string | null;
  agencia: string;
  conta: string;
  digito: string | null;
  tipo_conta: string;
  is_principal: boolean;
};

type Dependente = {
  id: number;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  parentesco: string;
  is_dependente_irrf: boolean;
  is_salario_familia: boolean;
};

type ColaboradorDetalhe = {
  id: number;
  tipo_pessoa: string;
  cpf: string;
  nome_completo: string;
  nome_social: string | null;
  email: string | null;
  telefone: string | null;
  genero: string | null;
  estado_civil: string | null;
  is_ativo: boolean;
  vinculos: Vinculo[];
  endereco: Endereco;
  contasBancarias: ContaBancaria[];
  dependentes: Dependente[];
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

  // edição de dados básicos
  const [editandoDados, setEditandoDados] = useState(false);
  const [formDados, setFormDados] = useState({ nomeCompleto: "", nomeSocial: "", email: "", telefone: "" });
  const [salvandoDados, setSalvandoDados] = useState(false);

  // edição de vínculo
  const [editandoVinculoId, setEditandoVinculoId] = useState<number | null>(null);
  const [formVinculo, setFormVinculo] = useState({ cargo: "", salarioBase: "", valorProLabore: "" });
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  // encerrar vínculo
  const [encerrandoVinculoId, setEncerrandoVinculoId] = useState<number | null>(null);
  const [dataEncerramento, setDataEncerramento] = useState("");

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/dp/colaboradores/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ao carregar (${res.status})`);
      setColaborador(data);
      setFormDados({
        nomeCompleto: data.nome_completo || "",
        nomeSocial: data.nome_social || "",
        email: data.email || "",
        telefone: data.telefone || "",
      });
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar colaborador.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function salvarDados() {
    setSalvandoDados(true);
    try {
      const res = await fetch(`/api/dp/colaboradores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDados),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar");
      setEditandoDados(false);
      await load();
    } catch (e: any) {
      alert(e.message || "Erro ao salvar dados.");
    } finally {
      setSalvandoDados(false);
    }
  }

  function iniciarEdicaoVinculo(v: Vinculo) {
    setEditandoVinculoId(v.id);
    setFormVinculo({
      cargo: v.cargo || "",
      salarioBase: v.salario_base || "",
      valorProLabore: v.valor_pro_labore || "",
    });
  }

  async function salvarVinculo(vinculoId: number) {
    setSalvandoVinculo(true);
    try {
      const res = await fetch(`/api/dp/vinculos/${vinculoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargo: formVinculo.cargo || undefined,
          salarioBase: formVinculo.salarioBase ? Number(formVinculo.salarioBase) : undefined,
          valorProLabore: formVinculo.valorProLabore ? Number(formVinculo.valorProLabore) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar vínculo");
      setEditandoVinculoId(null);
      await load();
    } catch (e: any) {
      alert(e.message || "Erro ao salvar vínculo.");
    } finally {
      setSalvandoVinculo(false);
    }
  }

  async function encerrarVinculo(vinculoId: number) {
    if (!dataEncerramento) {
      alert("Informe a data de encerramento.");
      return;
    }
    try {
      const res = await fetch(`/api/dp/vinculos/${vinculoId}/encerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataDemissao: dataEncerramento }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao encerrar vínculo");
      setEncerrandoVinculoId(null);
      setDataEncerramento("");
      await load();
    } catch (e: any) {
      alert(e.message || "Erro ao encerrar vínculo.");
    }
  }

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contato</CardTitle>
          {!editandoDados && (
            <Button size="sm" variant="ghost" onClick={() => setEditandoDados(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editandoDados ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome completo</Label>
                <Input value={formDados.nomeCompleto} onChange={(e) => setFormDados({ ...formDados, nomeCompleto: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Nome social</Label>
                <Input value={formDados.nomeSocial} onChange={(e) => setFormDados({ ...formDados, nomeSocial: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input value={formDados.email} onChange={(e) => setFormDados({ ...formDados, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={formDados.telefone} onChange={(e) => setFormDados({ ...formDados, telefone: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarDados} disabled={salvandoDados}>
                  {salvandoDados ? "Salvando..." : "Salvar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditandoDados(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm space-y-1">
              <p>E-mail: {colaborador.email || "—"}</p>
              <p>Telefone: {colaborador.telefone || "—"}</p>
              {colaborador.nome_social && <p>Nome social: {colaborador.nome_social}</p>}
            </div>
          )}
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

                  {editandoVinculoId === v.id ? (
                    <div className="space-y-2 mt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Cargo</Label>
                        <Input value={formVinculo.cargo} onChange={(e) => setFormVinculo({ ...formVinculo, cargo: e.target.value })} />
                      </div>
                      {v.tipo_vinculo === "PRO_LABORE" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Valor do pró-labore (R$)</Label>
                          <Input type="number" step="0.01" value={formVinculo.valorProLabore} onChange={(e) => setFormVinculo({ ...formVinculo, valorProLabore: e.target.value })} />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Salário base (R$)</Label>
                          <Input type="number" step="0.01" value={formVinculo.salarioBase} onChange={(e) => setFormVinculo({ ...formVinculo, salarioBase: e.target.value })} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => salvarVinculo(v.id)} disabled={salvandoVinculo}>
                          {salvandoVinculo ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditandoVinculoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : encerrandoVinculoId === v.id ? (
                    <div className="space-y-2 mt-2 bg-red-50 border border-red-200 rounded p-2">
                      <Label className="text-xs">Data de encerramento</Label>
                      <Input type="date" value={dataEncerramento} onChange={(e) => setDataEncerramento(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => encerrarVinculo(v.id)}>
                          Confirmar encerramento
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEncerrandoVinculoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {v.cargo && <p className="text-muted-foreground">{v.cargo}</p>}
                      <p className="text-muted-foreground">
                        Admissão: {new Date(v.data_admissao).toLocaleDateString("pt-BR")}
                        {v.data_demissao && ` — Desligamento: ${new Date(v.data_demissao).toLocaleDateString("pt-BR")}`}
                      </p>
                      <p>
                        {v.tipo_vinculo === "PRO_LABORE"
                          ? `Pró-labore: R$ ${Number(v.valor_pro_labore).toFixed(2)}`
                          : `Salário: R$ ${Number(v.salario_base).toFixed(2)}`}
                      </p>
                      {v.is_ativo && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => iniciarEdicaoVinculo(v)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                          {v.tipo_vinculo === "CLT" ? (
                            <Button asChild size="sm" variant="destructive">
                              <Link href={`/dp/colaboradores/${id}/vinculos/${v.id}/rescisao`}>
                                Calcular rescisão
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => setEncerrandoVinculoId(v.id)}>
                              Encerrar vínculo
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DadosComplementares
        colaboradorId={colaborador.id}
        endereco={colaborador.endereco}
        contasBancarias={colaborador.contasBancarias}
        dependentes={colaborador.dependentes}
        onAtualizado={load}
      />
    </div>
  );
}
