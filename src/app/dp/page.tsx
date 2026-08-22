"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Clock,
  FileText,
  UserPlus,
  CalendarDays,
  LogOut,
  Receipt,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Colaborador = { id: number; tipo_pessoa: string; nome_completo: string; is_ativo: boolean };
type ProLabore = { id: number; competencia: string; status: string; valor_liquido: string; colaborador_nome: string };

const STATUS_STYLE: Record<string, string> = {
  PAGO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDENTE: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELADO: "bg-red-50 text-red-700 border-red-200",
};

const CARD_STYLE: Record<string, string> = {
  blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
  violet: "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
  amber: "bg-gradient-to-br from-amber-500 to-orange-500 text-white",
};

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
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
    <div className="min-h-screen bg-slate-50 -m-6">
      {/* Header com gradiente — mesmo padrão do Financeiro */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6 rounded-b-3xl shadow-lg mb-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Departamento Pessoal</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Colaboradores, folha e pró-labore</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dp/colaboradores"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/20 hover:bg-white/25 transition"
            >
              Colaboradores
            </Link>
            <Link
              href="/dp/colaboradores/novo"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              + Novo Colaborador
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-5">
        {/* Cards de resumo — fundo colorido cheio */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`p-5 rounded-2xl shadow-lg ${CARD_STYLE.blue}`}>
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Colaboradores ativos</p>
            <p className="text-2xl font-bold mt-1">{ativos.length}</p>
          </div>
          <div className={`p-5 rounded-2xl shadow-lg ${CARD_STYLE.violet}`}>
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <UserCheck className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Sócios (pró-labore)</p>
            <p className="text-2xl font-bold mt-1">{socios.length}</p>
          </div>
          <div className={`p-5 rounded-2xl shadow-lg ${CARD_STYLE.amber}`}>
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Pró-labore pendente</p>
            <p className="text-2xl font-bold mt-1">{pendentes.length}</p>
          </div>
        </div>

        {/* Ações rápidas */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Ações rápidas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickAction href="/dp/folha" icon={<FileText className="h-5 w-5" />} label="Processar Folha" />
              <QuickAction href="/dp/colaboradores/novo" icon={<UserPlus className="h-5 w-5" />} label="Novo Colaborador" />
              <QuickAction href="/dp/ferias" icon={<CalendarDays className="h-5 w-5" />} label="Agendar Férias" />
              <QuickAction href="/dp/rescisoes" icon={<LogOut className="h-5 w-5" />} label="Calcular Rescisão" />
            </div>
          </CardContent>
        </Card>

        {/* Pró-labore pendente */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-indigo-500" />
                Pró-labore pendente
              </h2>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dp/pro-labore">Ver tudo →</Link>
              </Button>
            </div>
            {pendentes.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Nenhum pagamento pendente.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendentes.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.colaborador_nome}</p>
                      <p className="text-xs text-slate-400">Competência {p.competencia}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-800">
                        R$ {Number(p.valor_liquido).toFixed(2)}
                      </span>
                      <Badge className={`border ${STATUS_STYLE[p.status] || ""}`} variant="outline">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atalhos completos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Atalho href="/dp/colaboradores" label="Colaboradores" />
          <Atalho href="/dp/pro-labore" label="Pró-labore" />
          <Atalho href="/dp/rubricas" label="Rubricas" />
          <Atalho href="/dp/decimo-terceiro" label="13º Salário" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition text-center"
    >
      <span className="text-indigo-500">{icon}</span>
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </Link>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block p-3 bg-white border border-slate-200 rounded-lg text-center text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 transition"
    >
      {label}
    </Link>
  );
}
