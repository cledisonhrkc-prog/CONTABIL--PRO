"use client";

import { useState } from "react";
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

export default function NovoColaboradorPage() {
  const router = useRouter();
  const [tipoPessoa, setTipoPessoa] = useState("FUNCIONARIO");
  const [cpf, setCpf] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");
    try {
      const res = await fetch("/api/dp/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoPessoa, cpf, nomeCompleto, email: email || undefined, telefone: telefone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar");
      router.push(`/dp/colaboradores/${data.id}`);
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar colaborador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dp/colaboradores">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Novo Colaborador</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados básicos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoPessoa} onValueChange={setTipoPessoa}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                  <SelectItem value="SOCIO">Sócio</SelectItem>
                  <SelectItem value="ESTAGIARIO">Estagiário</SelectItem>
                  <SelectItem value="AUTONOMO">Autônomo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="Somente números"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar colaborador"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
