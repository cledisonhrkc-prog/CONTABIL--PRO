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
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen -m-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departamento Pessoal</h1>
          <p className="text-slate-500">Colaboradores, folha e pró-labore</p>
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

      {/* Cards de resumo, com ícone e cor */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Colaboradores ativos"
          value={ativos.length}
          color="blue"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Sócios (pró-labore)"
          value={socios.length}
          color="violet"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pró-labore pendente"
          value={pendentes.length}
          color="amber"
        />
      </div>

      {/* Ações rápidas */}
      <Card className="border-slate-200">
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
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-400" />
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

      {/* Atalhos completos (todas as telas) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Atalho href="/dp/colaboradores" label="Colaboradores" />
        <Atalho href="/dp/pro-labore" label="Pró-labore" />
        <Atalho href="/dp/rubricas" label="Rubricas" />
        <Atalho href="/dp/decimo-terceiro" label="13º Salário" />
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string; iconBg: string }> = {
  blue: { bg: "bg-white", text: "text-blue-600", iconBg: "bg-blue-50" },
  violet: { bg: "bg-white", text: "text-violet-600", iconBg: "bg-violet-50" },
  amber: { bg: "bg-white", text: "text-amber-600", iconBg: "bg-amber-50" },
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "violet" | "amber";
}) {
  const c = COLOR_MAP[color];
  return (
    <Card className={`border-slate-200 ${c.bg}`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl ${c.iconBg} ${c.text} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition text-center"
    >
      <span className="text-slate-500">{icon}</span>
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </Link>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block p-3 bg-white border border-slate-200 rounded-lg text-center text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition"
    >
      {label}
    </Link>
  );
}
