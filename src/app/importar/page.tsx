"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

type Result = {
  ok: boolean;
  processadas?: number;
  erros?: Array<{ arquivo: string; erro: string }>;
  result?: {
    lancamentos: number;
    aliquotaEfetivaSimples: number;
    rbt12Usado: number;
    rbt12Estimado: boolean;
    tempoMs?: number;
    auditoriaR08: { erros: number; creditoRecuperavel: number };
  };
  error?: string;
  empresa?: { nome: string; cnpj: string; regime: string };
};

export default function ImportarPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [regime, setRegime] = useState("SIMPLES");
  const [anexo, setAnexo] = useState("I");
  const [rbt12, setRbt12] = useState<string>("");
  const [cnpj, setCnpj] = useState("03000000000191");
  const [nome, setNome] = useState("EMPRESA IMPORTADA LTDA");
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [qtdSeed, setQtdSeed] = useState(1000);

  async function upload() {
    if (!files || files.length === 0) return alert("Selecione arquivos XML");
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    fd.append("regime", regime);
    fd.append("anexo", anexo);
    fd.append("cnpj", cnpj);
    fd.append("nome", nome);
    if (rbt12) fd.append("rbt12", rbt12);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      setResult(j);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    }
    setLoading(false);
  }

  async function seed() {
    if (!confirm(`Isso vai APAGAR todos os dados e gerar ${qtdSeed} NF-e fictícias. Confirmar?`)) return;
    setSeedLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qtd: qtdSeed,
          regime,
          anexo,
          rbt12: rbt12 ? Number(rbt12) : null,
        }),
      });
      const j = await r.json();
      setResult(j);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    }
    setSeedLoading(false);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Importar NF-e (XML)</h1>
          <p className="text-slate-500 mb-6">
            Faça upload de arquivos XML de NF-e para contabilização automática (partidas dobradas)
            ou gere 1.000 notas fictícias para testar o sistema.
          </p>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Upload */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="font-semibold text-slate-800 mb-4">📤 Upload de XMLs</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CNPJ da empresa</label>
                  <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome da empresa</label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Regime tributário</label>
                    <select value={regime} onChange={(e) => setRegime(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                      <option value="SIMPLES">Simples Nacional</option>
                      <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                      <option value="LUCRO_REAL">Lucro Real</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Anexo (Simples)</label>
                    <select value={anexo} onChange={(e) => setAnexo(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                      <option value="I">Anexo I — Comércio</option>
                      <option value="II">Anexo II — Indústria</option>
                      <option value="III">Anexo III — Serviços</option>
                      <option value="IV">Anexo IV — Serviços especializados</option>
                      <option value="V">Anexo V — Serviços de tecnologia</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    RBT12 (Receita últimos 12 meses) — deixe vazio para estimar
                  </label>
                  <input
                    value={rbt12}
                    onChange={(e) => setRbt12(e.target.value)}
                    placeholder="Ex.: 600000"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Arquivos XML</label>
                  <input
                    type="file"
                    multiple
                    accept=".xml"
                    onChange={(e) => setFiles(e.target.files)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  {files && <div className="text-xs text-slate-500 mt-1">{files.length} arquivo(s) selecionado(s)</div>}
                </div>
                <button
                  onClick={upload}
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md font-medium"
                >
                  {loading ? "Processando..." : "Enviar e Contabilizar"}
                </button>
              </div>
            </div>

            {/* Seed */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="font-semibold text-slate-800 mb-4">🧪 Gerar Dados Fictícios (Demo)</h2>
              <p className="text-sm text-slate-500 mb-4">
                Popula o sistema com notas fictícias para stress-test. Inclui vendas, compras, serviços,
                produtos monofásicos com CST errado (dispara auditoria R08), tributação completa.
              </p>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade de notas</label>
                <input
                  type="number"
                  value={qtdSeed}
                  onChange={(e) => setQtdSeed(Number(e.target.value))}
                  min={10}
                  max={2000}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={seed}
                disabled={seedLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-md font-medium"
              >
                {seedLoading ? "Gerando..." : `Gerar ${qtdSeed} NF-e Fictícias`}
              </button>
              <p className="text-xs text-amber-700 mt-2">
                ⚠️ Atenção: isso apaga TODOS os dados atuais.
              </p>
            </div>
          </div>

          {result && (
            <div className={`mt-6 border rounded-lg p-5 ${result.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <h3 className="font-semibold text-slate-800 mb-2">
                {result.ok ? "✅ Contabilização concluída" : "❌ Erro"}
              </h3>
              {result.error && <div className="text-sm text-red-700">{result.error}</div>}
              {result.ok && result.result && (
                <ul className="text-sm text-slate-700 space-y-1">
                  {result.processadas !== undefined && <li>📄 Notas processadas: <b>{result.processadas}</b></li>}
                  <li>📝 Lançamentos gerados (total): <b>{result.result.lancamentos}</b></li>
                  {regime === "SIMPLES" && (
                    <>
                      <li>💰 RBT12 usado: R$ {result.result.rbt12Usado.toLocaleString("pt-BR")} {result.result.rbt12Estimado ? "(estimado)" : "(informado)"}</li>
                      <li>📊 Alíquota efetiva Simples: <b>{(result.result.aliquotaEfetivaSimples * 100).toFixed(4)}%</b></li>
                    </>
                  )}
                  <li>🔍 Auditoria R08: <b>{result.result.auditoriaR08.erros}</b> erro(s) — crédito recuperável R$ {result.result.auditoriaR08.creditoRecuperavel.toLocaleString("pt-BR")}</li>
                </ul>
              )}
              {result.erros && result.erros.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-red-700 cursor-pointer">Ver {result.erros.length} erro(s) de parse</summary>
                  <ul className="text-xs mt-2 space-y-1">
                    {result.erros.map((e, i) => (
                      <li key={i}>{e.arquivo}: {e.erro}</li>
                    ))}
                  </ul>
                </details>
              )}
              {result.ok && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href="/" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md">Ver Dashboard</a>
                  <a href="/api/exportar/pdf" className="text-sm bg-red-700 text-white px-4 py-2 rounded-md">📄 PDF Sênior</a>
                  <a href="/api/exportar/excel" className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-md">📗 Excel</a>
                  <a href="/api/exportar/word" className="text-sm bg-blue-700 text-white px-4 py-2 rounded-md">📘 Word</a>
                  {result.result && "tempoMs" in result.result && (
                    <span className="text-xs text-slate-500 self-center">⚡ processado em {Math.round((result.result as { tempoMs?: number }).tempoMs ?? 0)}ms</span>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
