"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Download, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface LinhaConvenio {
  nome: string;
  cpf: string;
  rubrica: string;
  valor: number;
}

export default function RelatorioConvenioPage() {
  const [competencia, setCompetencia] = useState(mesAtual());
  const [palavraChave, setPalavraChave] = useState("convenio");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [linhas, setLinhas] = useState<LinhaConvenio[]>([]);
  const [csvBruto, setCsvBruto] = useState("");

  async function buscar() {
    setCarregando(true);
    setErro("");
    setAviso("");
    setLinhas([]);
    setCsvBruto("");
    try {
      const params = new URLSearchParams({ competencia, palavraChave });
      const res = await fetch(`/api/dp/relatorio-convenio?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao buscar relatório.");

      if (data.aviso) {
        setAviso(data.aviso);
        return;
      }

      setCsvBruto(data.csv);
      // Reconstrói as linhas a partir do CSV pra exibir em tabela
      const linhasCsv = data.csv.split("\r\n").slice(1); // pula cabeçalho
      const parsed: LinhaConvenio[] = linhasCsv
        .filter((l: string) => l.trim())
        .map((l: string) => {
          const [nome, cpf, rubrica, valorStr] = l.split(";");
          return { nome, cpf, rubrica, valor: Number(valorStr.replace(",", ".")) };
        });
      setLinhas(parsed);
    } catch (e: any) {
      setErro(e.message || "Erro ao buscar relatório.");
    } finally {
      setCarregando(false);
    }
  }

  function baixarCsv() {
    if (!csvBruto) return;
    const blob = new Blob(["\uFEFF" + csvBruto], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `convenio-${competencia}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Convênio</h1>
          <p className="text-sm text-slate-500">
            Descontos de plano de saúde, odontológico e seguro por competência — pra anexar em email pra operadora
          </p>
        </div>
        <Link href="/dp" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Competência</label>
            <input
              type="month"
              className="w-full border border-slate-200 rounded-lg p-2 text-sm"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">
              Palavra-chave (além de "odonto", "saúde", "plano", "seguro")
            </label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2 text-sm"
              value={palavraChave}
              onChange={(e) => setPalavraChave(e.target.value)}
              placeholder="ex: convenio, unimed, amil..."
            />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          onClick={buscar}
          disabled={carregando}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          {carregando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {aviso && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{aviso}</div>
      )}

      {linhas.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {linhas.length} linha(s) — Total: R$ {totalGeral.toFixed(2).replace(".", ",")}
            </h2>
            <button
              onClick={baixarCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5" /> Baixar CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-400">
                <th className="p-2">Nome</th>
                <th className="p-2">CPF</th>
                <th className="p-2">Rubrica</th>
                <th className="p-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-2">{l.nome}</td>
                  <td className="p-2">{l.cpf}</td>
                  <td className="p-2">{l.rubrica}</td>
                  <td className="p-2 text-right">R$ {l.valor.toFixed(2).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
