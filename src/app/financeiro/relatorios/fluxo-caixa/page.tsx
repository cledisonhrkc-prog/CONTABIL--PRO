"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Empresa = { id: number; nome: string; cnpj: string };

export default function ExportarFluxoCaixaPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [mes, setMes] = useState<string>(""); // vazio = próximos 6 meses
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/minhas-empresas")
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : data?.value || [];
        setEmpresas(lista);
        if (lista.length > 0) setEmpresaId(String(lista[0].id));
      })
      .catch(() => setErro("Erro ao carregar lista de empresas."))
      .finally(() => setCarregando(false));
  }, []);

  function baixarPdf(formato: "pdf" | "excel") {
    const params = new URLSearchParams();
    if (empresaId) params.set("empresaId", empresaId);
    if (mes) params.set("mes", mes);
    const url = `/api/financeiro/relatorios/fluxo-caixa/${formato}?${params.toString()}`;
    window.open(url, "_blank");
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/financeiro" className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Exportar Relatório de Fluxo de Caixa</h1>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Empresa</label>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : erro ? (
            <p className="text-sm text-red-600">{erro}</p>
          ) : (
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome} — {emp.cnpj}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Período</label>
          <select className="w-full border rounded-md p-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Próximos 6 meses (padrão)</option>
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() + i);
              const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
              return (
                <option key={valor} value={valor}>
                  Só {label}
                </option>
              );
            })}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          O relatório inclui o resumo mensal de entradas/saídas e a lista detalhada das contas a
          receber e a pagar em aberto (até 40 itens por seção).
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => baixarPdf("pdf")}
            disabled={!empresaId}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Baixar PDF
          </button>
          <button
            onClick={() => baixarPdf("excel")}
            disabled={!empresaId}
            className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Baixar Excel
          </button>
        </div>
      </div>
    </div>
  );
}
