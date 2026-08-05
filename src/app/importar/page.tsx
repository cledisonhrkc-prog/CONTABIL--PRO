"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

type UploadLote = {
  processadas: number;
  erros: Array<{ arquivo: string; erro: string }>;
  lancamentos: number;
  tempoMs: number;
  aliqEfetiva: number;
  auditR08Erros: number;
  auditR08Credito: number;
  rbt12: number;
  rbt12Estimado: boolean;
};

// Vercel corta requests > 4.5MB e funções > 60s. Um XML de NF-e tem
// ~10-30KB. Mandar 40 por lote = ~1MB, cabe folgado. Não paralelizar
// pra não estourar o pool de conexões do Neon/Supabase.
const CHUNK_SIZE = 40;

export default function ImportarPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [regime, setRegime] = useState("SIMPLES");
  const [anexo, setAnexo] = useState("I");
  const [rbt12, setRbt12] = useState<string>("");
  const [cnpj, setCnpj] = useState("03000000000191");
  const [nome, setNome] = useState("EMPRESA IMPORTADA LTDA");
  const [running, setRunning] = useState(false);
  const [seedRunning, setSeedRunning] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number; msg: string } | null>(null);
  const [resumo, setResumo] = useState<UploadLote | null>(null);
  const [erroGeral, setErroGeral] = useState<string>("");
  const [qtdSeed, setQtdSeed] = useState(1000);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return setFiles([]);
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    setFiles(arr);
    setErroGeral("");
    setResumo(null);
  }

  async function enviarLote(chunk: File[]): Promise<{
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
  }> {
    const fd = new FormData();
    for (const f of chunk) fd.append("files", f);
    fd.append("regime", regime);
    fd.append("anexo", anexo);
    fd.append("cnpj", cnpj);
    fd.append("nome", nome);
    if (rbt12) fd.append("rbt12", rbt12);

    let resp: Response;
    try {
      resp = await fetch("/api/upload", { method: "POST", body: fd });
    } catch (e) {
      return { ok: false, error: "Falha de rede: " + (e as Error).message };
    }

    // Ler como texto primeiro (evita "Unexpected token" quando volta HTML de erro)
    const text = await resp.text();
    if (!resp.ok) {
      const msg =
        resp.status === 413
          ? `Lote muito grande (HTTP 413). Reduza CHUNK_SIZE. Bytes: ~${chunk.reduce((a, f) => a + f.size, 0)}`
          : resp.status === 504
          ? `Timeout no servidor (HTTP 504). Reduza CHUNK_SIZE ou aumente maxDuration.`
          : `HTTP ${resp.status}: ${text.substring(0, 200)}`;
      return { ok: false, error: msg };
    }
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: "Resposta não-JSON: " + text.substring(0, 200) };
    }
  }

  async function uploadCompleto() {
    if (files.length === 0) return alert("Selecione arquivos XML");
    setRunning(true);
    setErroGeral("");
    setResumo(null);

    const totalChunks = Math.ceil(files.length / CHUNK_SIZE);
    const acumulado: UploadLote = {
      processadas: 0,
      erros: [],
      lancamentos: 0,
      tempoMs: 0,
      aliqEfetiva: 0,
      auditR08Erros: 0,
      auditR08Credito: 0,
      rbt12: 0,
      rbt12Estimado: false,
    };

    for (let i = 0; i < totalChunks; i++) {
      const chunk = files.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      setProgresso({
        atual: i + 1,
        total: totalChunks,
        msg: `Enviando lote ${i + 1}/${totalChunks} (${chunk.length} arquivos)...`,
      });

      const r = await enviarLote(chunk);
      if (!r.ok) {
        setErroGeral(
          `Falhou no lote ${i + 1}/${totalChunks}: ${r.error}. Já foram processados ${acumulado.processadas} arquivos.`
        );
        setRunning(false);
        setProgresso(null);
        setResumo(acumulado.processadas > 0 ? acumulado : null);
        return;
      }
      acumulado.processadas += r.processadas ?? 0;
      if (r.erros) acumulado.erros.push(...r.erros);
      if (r.result) {
        acumulado.lancamentos = r.result.lancamentos;
        acumulado.tempoMs += r.result.tempoMs ?? 0;
        acumulado.aliqEfetiva = r.result.aliquotaEfetivaSimples;
        acumulado.auditR08Erros += r.result.auditoriaR08.erros;
        acumulado.auditR08Credito += r.result.auditoriaR08.creditoRecuperavel;
        acumulado.rbt12 = r.result.rbt12Usado;
        acumulado.rbt12Estimado = r.result.rbt12Estimado;
      }
      setProgresso({
        atual: i + 1,
        total: totalChunks,
        msg: `✓ ${acumulado.processadas} de ${files.length} arquivos processados.`,
      });
    }

    setResumo(acumulado);
    setRunning(false);
    setProgresso(null);
  }

  async function seedDemo() {
    if (!confirm(`Isso apaga TODOS os dados atuais e gera ${qtdSeed} NF-e fictícias. Confirmar?`)) return;
    setSeedRunning(true);
    setErroGeral("");
    setResumo(null);
    try {
      const r = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qtd: qtdSeed, regime, anexo,
          rbt12: rbt12 ? Number(rbt12) : null,
          ano_inicio: 2025, ano_fim: 2027,
        }),
      });
      const text = await r.text();
      let j: {
        ok: boolean;
        result?: {
          lotesProcessados: number;
          lancamentos: number;
          aliquotaEfetivaSimples: number;
          rbt12Usado: number;
          rbt12Estimado: boolean;
          tempoMs: number;
          auditoriaR08: { erros: number; creditoRecuperavel: number };
        };
        error?: string;
      };
      try {
        j = JSON.parse(text);
      } catch {
        setErroGeral(`Resposta não-JSON do servidor (HTTP ${r.status}): ${text.substring(0, 250)}`);
        setSeedRunning(false);
        return;
      }
      if (!j.ok) {
        setErroGeral("Erro no servidor: " + (j.error ?? "desconhecido"));
      } else if (j.result) {
        setResumo({
          processadas: j.result.lotesProcessados,
          erros: [],
          lancamentos: j.result.lancamentos,
          tempoMs: j.result.tempoMs,
          aliqEfetiva: j.result.aliquotaEfetivaSimples,
          auditR08Erros: j.result.auditoriaR08.erros,
          auditR08Credito: j.result.auditoriaR08.creditoRecuperavel,
          rbt12: j.result.rbt12Usado,
          rbt12Estimado: j.result.rbt12Estimado,
        });
      }
    } catch (e) {
      setErroGeral("Falha de rede: " + (e as Error).message);
    }
    setSeedRunning(false);
  }

  const totalMB = (files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Importar NF-e (XML)</h1>
          <p className="text-slate-500 mb-6">
            Upload em lotes de {CHUNK_SIZE} arquivos por vez (evita limites da Vercel), com barra de progresso e tratamento de erro.
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">RBT12 (opcional)</label>
                  <input value={rbt12} onChange={(e) => setRbt12(e.target.value)} placeholder="Ex.: 600000" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Arquivos XML (múltiplos)</label>
                  <input type="file" multiple accept=".xml" onChange={onFileChange} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                  {files.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      📦 {files.length} arquivo(s) · {totalMB} MB total ·
                      {" "}<b>{Math.ceil(files.length / CHUNK_SIZE)} lote(s) de {CHUNK_SIZE}</b>
                    </div>
                  )}
                </div>
                <button
                  onClick={uploadCompleto}
                  disabled={running || files.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md font-medium"
                >
                  {running ? "Enviando..." : `Enviar ${files.length} arquivo(s) e Contabilizar`}
                </button>
              </div>
            </div>

            {/* Seed */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="font-semibold text-slate-800 mb-4">🧪 Gerar Dados Fictícios (Demo)</h2>
              <p className="text-sm text-slate-500 mb-4">
                Popula o sistema com notas fictícias distribuídas em 2025-2027 (para testar Pré-Reforma, Transição e Reforma 2027).
              </p>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade de notas</label>
                <input type="number" value={qtdSeed} onChange={(e) => setQtdSeed(Number(e.target.value))} min={10} max={2000} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button onClick={() => setQtdSeed(200)} className="text-xs bg-slate-100 hover:bg-slate-200 py-1 rounded">200</button>
                <button onClick={() => setQtdSeed(500)} className="text-xs bg-slate-100 hover:bg-slate-200 py-1 rounded">500</button>
                <button onClick={() => setQtdSeed(1000)} className="text-xs bg-slate-100 hover:bg-slate-200 py-1 rounded">1000</button>
              </div>
              <button
                onClick={seedDemo}
                disabled={seedRunning}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-md font-medium"
              >
                {seedRunning ? "Gerando..." : `Gerar ${qtdSeed} NF-e Fictícias`}
              </button>
              <p className="text-xs text-amber-700 mt-2">⚠️ Isso apaga TODOS os dados atuais.</p>
            </div>
          </div>

          {/* Barra de progresso */}
          {progresso && (
            <div className="mt-6 bg-white border border-indigo-200 rounded-lg p-4">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{progresso.msg}</span>
                <span>{Math.round((progresso.atual / progresso.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Erro geral */}
          {erroGeral && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-5">
              <h3 className="font-semibold text-red-900 mb-2">❌ Erro</h3>
              <p className="text-sm text-red-800 font-mono whitespace-pre-wrap">{erroGeral}</p>
              <div className="mt-4 text-xs text-red-700 space-y-1">
                <p><b>Diagnóstico rápido:</b></p>
                <p>• Se HTTP 413: seu lote é grande demais. Já mando em {CHUNK_SIZE} arquivos por vez — se ainda estourar, reduza.</p>
                <p>• Se HTTP 504 / timeout: banco está lento. Verifique se está usando pooler do Neon/Supabase (porta 6543).</p>
                <p>• Se &quot;column ... does not exist&quot;: o banco não tem as tabelas. Vá em <a href="/setup" className="underline">/setup</a> e clique &quot;Criar tabelas automaticamente&quot;.</p>
                <p>• Se &quot;DATABASE_URL is required&quot;: falta configurar a variável no Vercel.</p>
              </div>
            </div>
          )}

          {/* Resumo de sucesso */}
          {resumo && !erroGeral && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-5">
              <h3 className="font-semibold text-emerald-900 mb-2">✅ Contabilização concluída</h3>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>📄 Notas processadas: <b>{resumo.processadas}</b></li>
                <li>📝 Lançamentos totais: <b>{resumo.lancamentos.toLocaleString("pt-BR")}</b></li>
                <li>⚡ Tempo total: <b>{resumo.tempoMs.toLocaleString("pt-BR")} ms</b></li>
                {regime === "SIMPLES" && resumo.rbt12 > 0 && (
                  <li>💰 RBT12 {resumo.rbt12Estimado ? "estimado" : "informado"}: R$ {resumo.rbt12.toLocaleString("pt-BR")} → alíquota efetiva <b>{(resumo.aliqEfetiva * 100).toFixed(4)}%</b></li>
                )}
                <li>🔍 Auditoria R08: <b>{resumo.auditR08Erros}</b> erros · R$ {resumo.auditR08Credito.toLocaleString("pt-BR")} recuperável</li>
                {resumo.erros.length > 0 && (
                  <li>⚠️ {resumo.erros.length} arquivo(s) com erro de parse</li>
                )}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="/" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md">Dashboard</a>
                <a href="/api/exportar/pdf" className="text-sm bg-red-700 text-white px-4 py-2 rounded-md">📄 PDF</a>
                <a href="/api/exportar/excel" className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-md">📗 Excel</a>
                <a href="/api/exportar/word" className="text-sm bg-blue-700 text-white px-4 py-2 rounded-md">📘 Word</a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
