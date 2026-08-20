"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus } from "lucide-react";

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

const PARENTESCO_LABEL: Record<string, string> = {
  CONJUGE: "Cônjuge",
  FILHO: "Filho(a)",
  ENTEADO: "Enteado(a)",
  PAI: "Pai",
  MAE: "Mãe",
  OUTRO: "Outro",
};

export default function DadosComplementares({
  colaboradorId,
  endereco,
  contasBancarias,
  dependentes,
  onAtualizado,
}: {
  colaboradorId: number;
  endereco: Endereco;
  contasBancarias: ContaBancaria[];
  dependentes: Dependente[];
  onAtualizado: () => void;
}) {
  // ===== Endereço =====
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [formEndereco, setFormEndereco] = useState({
    cep: endereco?.cep || "",
    logradouro: endereco?.logradouro || "",
    numero: endereco?.numero || "",
    complemento: endereco?.complemento || "",
    bairro: endereco?.bairro || "",
    cidade: endereco?.cidade || "",
    uf: endereco?.uf || "",
  });
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  async function salvarEndereco() {
    setSalvandoEndereco(true);
    try {
      const res = await fetch(`/api/dp/colaboradores/${colaboradorId}/enderecos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formEndereco),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar endereço");
      setEditandoEndereco(false);
      onAtualizado();
    } catch (e: any) {
      alert(e.message || "Erro ao salvar endereço.");
    } finally {
      setSalvandoEndereco(false);
    }
  }

  // ===== Conta bancária =====
  const [novaConta, setNovaConta] = useState(false);
  const [formConta, setFormConta] = useState({
    bancoCodigo: "",
    bancoNome: "",
    agencia: "",
    conta: "",
    digito: "",
    tipoConta: "CORRENTE",
    isPrincipal: contasBancarias.length === 0,
  });
  const [salvandoConta, setSalvandoConta] = useState(false);

  async function adicionarConta() {
    if (!formConta.bancoCodigo || !formConta.agencia || !formConta.conta) {
      alert("Preencha ao menos código do banco, agência e conta.");
      return;
    }
    setSalvandoConta(true);
    try {
      const res = await fetch(`/api/dp/colaboradores/${colaboradorId}/contas-bancarias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formConta),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao adicionar conta bancária");
      setNovaConta(false);
      setFormConta({ bancoCodigo: "", bancoNome: "", agencia: "", conta: "", digito: "", tipoConta: "CORRENTE", isPrincipal: false });
      onAtualizado();
    } catch (e: any) {
      alert(e.message || "Erro ao adicionar conta bancária.");
    } finally {
      setSalvandoConta(false);
    }
  }

  // ===== Dependentes =====
  const [novoDependente, setNovoDependente] = useState(false);
  const [formDependente, setFormDependente] = useState({
    nomeCompleto: "",
    cpf: "",
    dataNascimento: "",
    parentesco: "FILHO",
    isDependenteIrrf: true,
    isSalarioFamilia: false,
  });
  const [salvandoDependente, setSalvandoDependente] = useState(false);

  async function adicionarDependente() {
    if (!formDependente.nomeCompleto || !formDependente.parentesco) {
      alert("Preencha ao menos nome e parentesco.");
      return;
    }
    setSalvandoDependente(true);
    try {
      const res = await fetch(`/api/dp/colaboradores/${colaboradorId}/dependentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDependente),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao adicionar dependente");
      setNovoDependente(false);
      setFormDependente({ nomeCompleto: "", cpf: "", dataNascimento: "", parentesco: "FILHO", isDependenteIrrf: true, isSalarioFamilia: false });
      onAtualizado();
    } catch (e: any) {
      alert(e.message || "Erro ao adicionar dependente.");
    } finally {
      setSalvandoDependente(false);
    }
  }

  return (
    <>
      {/* ===== Endereço ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Endereço</CardTitle>
          {!editandoEndereco && (
            <Button size="sm" variant="ghost" onClick={() => setEditandoEndereco(true)}>
              <Pencil className="h-4 w-4 mr-1" /> {endereco ? "Editar" : "Adicionar"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editandoEndereco ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <Input value={formEndereco.cep} onChange={(e) => setFormEndereco({ ...formEndereco, cep: e.target.value })} maxLength={8} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UF</Label>
                  <Input value={formEndereco.uf} onChange={(e) => setFormEndereco({ ...formEndereco, uf: e.target.value.toUpperCase() })} maxLength={2} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Logradouro</Label>
                <Input value={formEndereco.logradouro} onChange={(e) => setFormEndereco({ ...formEndereco, logradouro: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Número</Label>
                  <Input value={formEndereco.numero} onChange={(e) => setFormEndereco({ ...formEndereco, numero: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={formEndereco.complemento} onChange={(e) => setFormEndereco({ ...formEndereco, complemento: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={formEndereco.bairro} onChange={(e) => setFormEndereco({ ...formEndereco, bairro: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={formEndereco.cidade} onChange={(e) => setFormEndereco({ ...formEndereco, cidade: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarEndereco} disabled={salvandoEndereco}>
                  {salvandoEndereco ? "Salvando..." : "Salvar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditandoEndereco(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : endereco ? (
            <p className="text-sm">
              {endereco.logradouro}, {endereco.numero}
              {endereco.complemento && ` - ${endereco.complemento}`}
              <br />
              {endereco.bairro} — {endereco.cidade}/{endereco.uf} — CEP {endereco.cep}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
          )}
        </CardContent>
      </Card>

      {/* ===== Contas bancárias ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contas Bancárias</CardTitle>
          {!novaConta && (
            <Button size="sm" variant="outline" onClick={() => setNovaConta(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova conta
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {contasBancarias.length === 0 && !novaConta && (
            <p className="text-sm text-muted-foreground">Nenhuma conta bancária cadastrada.</p>
          )}
          {contasBancarias.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 text-sm flex justify-between items-center">
              <span>
                {c.banco_nome || `Banco ${c.banco_codigo}`} — Ag {c.agencia} / Conta {c.conta}
                {c.digito && `-${c.digito}`} ({c.tipo_conta})
              </span>
              {c.is_principal && <Badge>Principal</Badge>}
            </div>
          ))}
          {novaConta && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código do banco</Label>
                  <Input value={formConta.bancoCodigo} onChange={(e) => setFormConta({ ...formConta, bancoCodigo: e.target.value })} placeholder="ex: 341" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do banco</Label>
                  <Input value={formConta.bancoNome} onChange={(e) => setFormConta({ ...formConta, bancoNome: e.target.value })} placeholder="ex: Itaú" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Agência</Label>
                  <Input value={formConta.agencia} onChange={(e) => setFormConta({ ...formConta, agencia: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conta</Label>
                  <Input value={formConta.conta} onChange={(e) => setFormConta({ ...formConta, conta: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dígito</Label>
                  <Input value={formConta.digito} onChange={(e) => setFormConta({ ...formConta, digito: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={adicionarConta} disabled={salvandoConta}>
                  {salvandoConta ? "Salvando..." : "Adicionar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setNovaConta(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Dependentes ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dependentes</CardTitle>
          {!novoDependente && (
            <Button size="sm" variant="outline" onClick={() => setNovoDependente(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo dependente
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {dependentes.length === 0 && !novoDependente && (
            <p className="text-sm text-muted-foreground">Nenhum dependente cadastrado.</p>
          )}
          {dependentes.map((d) => (
            <div key={d.id} className="border rounded-lg p-3 text-sm flex justify-between items-center">
              <span>
                {d.nome_completo} — {PARENTESCO_LABEL[d.parentesco] || d.parentesco}
              </span>
              {d.is_dependente_irrf && <Badge variant="secondary">Dependente IRRF</Badge>}
            </div>
          ))}
          {novoDependente && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo</Label>
                <Input value={formDependente.nomeCompleto} onChange={(e) => setFormDependente({ ...formDependente, nomeCompleto: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CPF (opcional)</Label>
                  <Input value={formDependente.cpf} onChange={(e) => setFormDependente({ ...formDependente, cpf: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de nascimento</Label>
                  <Input type="date" value={formDependente.dataNascimento} onChange={(e) => setFormDependente({ ...formDependente, dataNascimento: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Parentesco</Label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={formDependente.parentesco}
                  onChange={(e) => setFormDependente({ ...formDependente, parentesco: e.target.value })}
                >
                  {Object.entries(PARENTESCO_LABEL).map(([valor, label]) => (
                    <option key={valor} value={valor}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dep-irrf"
                  checked={formDependente.isDependenteIrrf}
                  onChange={(e) => setFormDependente({ ...formDependente, isDependenteIrrf: e.target.checked })}
                />
                <label htmlFor="dep-irrf" className="text-sm cursor-pointer">
                  Usar como dependente no cálculo de IRRF
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={adicionarDependente} disabled={salvandoDependente}>
                  {salvandoDependente ? "Salvando..." : "Adicionar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setNovoDependente(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
