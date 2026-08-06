"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { parseNfeXml, type NF } from "@/lib/nfe-parser";

type UploadLote = {
  processadas: number;
  parseErros: Array<{ arquivo: string; erro: string }>;
  lancamentos: number;
  tempoMs: number;
  tempoParseMs: number;
  aliqEfetiva: number;
  auditR08Erros: number;
  auditR08Credito: number;
  rbt12: number;
  rbt12Estimado: boolean;
  dedup_recebidas: number;
  dedup_canceladas: number;
  dedup_no_lote: number;
  dedup_no_banco: number;
};

// PLANO B: XMLs são parseados NO NAVEGADOR (fast-xml-parser é universal)
// e enviados como JSON compacto. Payload de 200 notas ~ 100 KB (vs 4-8 MB de XML).
// Assim damos volta no limite de 4.5 MB da Vercel sem esforço.
const CHUNK_JSON = 200; // notas por request

export default function ImportarPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [regime, setRegime] = useState("SIMPLES");
  const [anexo, setAnexo] = useState("I");
  const [rbt12, setRbt12] = useState<string>("");
  const [cnpj, setCnpj] = useState("03000000000191");
  const [nome, setNome] = useState("EMPRESA IMPORTADA LTDA");
  const [running, setRunning] = useState(false);
  const [progresso, setProgresso] = useState<{ fase: string; atual: number; total: number } | null>(null);
  const [resumo, setResumo] = useState<UploadLote | null>(null);
  const [erroGeral, setErroGeral] = useState<string>("");

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return setFiles([]);
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    setFiles(arr);
    setErroGeral("");
    setResumo(null);
  }

  // Parse local — MUITO rápido, tudo em memória do navegador
  async function parseArquivosLocal(): Promise<{ nfs: NF[]; erros: Array<{ arquivo: string; erro: string }> }> {
    const nfs: NF[] = [];
    const erros: Array<{ arquivo: string; erro: string }> = [];
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const xml = await f.text();
        nfs.push(parseNfeXml(xml, cnpjLimpo));
      } catch (e) {
        erros.push({ arquivo: f.name, erro: (e as Error).message.substring(0, 200) });
      }
      // Progresso a cada 50 arquivos (não spam)
      if (i % 50 === 0 || i === files.length - 1) {
        setProgresso({ fase: "🔍 Parseando XMLs no navegador", atual: i + 1, total: files.length });
        // Yield ao browser pra não travar a UI
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    return { nfs, erros };
  }

  async function enviarLoteJson(nfs: NF[]): Promise<{
    ok: boolean;
    processadas?: number;
    result?: {
      lancamentos: number;
      aliquotaEfetivaSimples: number;
      rbt12Usado: number;
      rbt12Estimado: boolean;
      tempoMs?: number;
      dedup?: {
        recebidas: number;
        canceladas_ou_denegadas: number;
        duplicadas_no_lote: number;
        duplicadas_no_banco: number;
        unicas_processadas: number;
        rejeicoes_por_status?: Record<string, number>;
      };
      auditoriaR08: { erros: number; creditoRecuperavel: number };
    };
    error?: string;
  }> {
    let resp: Response;
    try {
      resp = await fetch("/api/upload-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, nome, regime, anexo, rbt12: rbt12 ? Number(rbt12) : null, nfs }),
      });
    } catch (e) {
      return { ok: false, error: "Falha de rede: " + (e as Error).message };
    }
    const text = await resp.text();
    if (!resp.ok) {
      return {
        ok: false,
        error:
          resp.status === 413
            ? `HTTP 413 (Payload too large). Reduza CHUNK_JSON (atual: ${CHUNK_JSON}).`
            : resp.status === 504
            ? `HTTP 504 (Timeout). Reduza CHUNK_JSON ou use plano B++ (Railway/Fly.io).`
            : `HTTP ${resp.status}: ${text.substring(0, 250)}`,
      };
    }
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: "Resposta não-JSON: " + text.substring(0, 250) };
    }
  }

  async function uploadCompleto() {
    if (files.length === 0) return alert("Selecione arquivos XML");
    setRunning(true);
    setErroGeral("");
    setResumo(null);

    const tParse0 = performance.now();
    const { nfs, erros: parseErros } = await parseArquivosLocal();
    const tParse = Math.round(performance.now() - tParse0);

    if (nfs.length === 0) {
      setErroGeral(`Nenhum XML válido. ${parseErros.length} arquivo(s) com erro de parse.`);
      setRunning(false);
      setProgresso(null);
      return;
    }

    const totalChunks = Math.ceil(nfs.length / CHUNK_JSON);
    const acumulado: UploadLote = {
      processadas: 0,
      parseErros,
      lancamentos: 0,
      tempoMs: 0,
      tempoParseMs: tParse,
      aliqEfetiva: 0,
      auditR08Erros: 0,
      auditR08Credito: 0,
      rbt12: 0,
      rbt12Estimado: false,
      dedup_recebidas: 0,
      dedup_canceladas: 0,
      dedup_no_lote: 0,
      dedup_no_banco: 0,
    };

    for (let i = 0; i < totalChunks; i++) {
      const chunk = nfs.slice(i * CHUNK_JSON, (i + 1) * CHUNK_JSON);
      setProgresso({
        fase: `📤 Enviando para o servidor (lote ${i + 1}/${totalChunks})`,
        atual: i + 1,
        total: totalChunks,
      });
      const r = await enviarLoteJson(chunk);
      if (!r.ok) {
        setErroGeral(
          `Falhou no lote ${i + 1}/${totalChunks}: ${r.error}\n\nJá processados: ${acumulado.processadas} notas.`
        );
        setRunning(false);
        setProgresso(null);
        setResumo(acumulado.processadas > 0 ? acumulado : null);
        return;
      }
      acumulado.processadas += r.processadas ?? 0;
      if (r.result) {
        acumulado.lancamentos = r.result.lancamentos;
        acumulado.tempoMs += r.result.tempoMs ?? 0;
        acumulado.aliqEfetiva = r.result.aliquotaEfetivaSimples;
        acumulado.auditR08Erros += r.result.auditoriaR08.erros;
        acumulado.auditR08Credito += r.result.auditoriaR08.creditoRecuperavel;
        acumulado.rbt12 = r.result.rbt12Usado;
        acumulado.rbt12Estimado = r.result.rbt12Estimado;
        if (r.result.dedup) {
          acumulado.dedup_recebidas += r.result.dedup.recebidas;
          acumulado.dedup_canceladas += r.result.dedup.canceladas_ou_denegadas;
          acumulado.dedup_no_lote += r.result.dedup.duplicadas_no_lote;
          acumulado.dedup_no_banco += r.result.dedup.duplicadas_no_banco;
        }
      }
    }

    setResumo(acumulado);
    setRunning(false);
    setProgresso(null);
  }

  const totalMB = (files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 rounded p-4">
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Importar NF-e (XML) — Plano B ⚡</h1>
            <p className="text-sm text-slate-700">
              <b>Parse dos XMLs feito NO NAVEGADOR</b> (não pesa no servidor). Só o resumo estruturado é enviado como JSON.
              Payload ~20× menor. Suporta <b>milhares de notas</b> na Vercel sem estourar os 4.5 MB.
            </p>
          </div>

          <div className="grid lg:grid-cols-1 gap-6 max-w-3xl">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="font-semibold text-slate-800 mb-4">📤 Upload em massa de XMLs</h2>
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
                    <label className="block text-xs font-medium text-slate-600 mb-1">Regime</label>
                    <select value={regime} onChange={(e) => setRegime(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                      <option value="SIMPLES">Simples Nacional</option>
                      <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                      <option value="LUCRO_REAL">Lucro Real</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Anexo (Simples)</label>
                    <select value={anexo} onChange={(e) => setAnexo(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                      <option value="I">I — Comércio</option>
                      <option value="II">II — Indústria</option>
                      <option value="III">III — Serviços</option>
                      <option value="IV">IV — Especializados</option>
                      <option value="V">V — Tecnologia</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    RBT12 — Receita Bruta últimos 12 meses (opcional)
                  </label>
                  <input value={rbt12} onChange={(e) => setRbt12(e.target.value)} placeholder="Ex.: 600000" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                  <p className="text-[11px] text-slate-500 mt-1">
                    ⚠️ NÃO é o faturamento do mês nem do lote. É o total dos <b>últimos 12 meses</b> da empresa.
                    Se deixar vazio, o sistema estima (lote × 12).
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Arquivos XML (selecione centenas ou milhares)</label>
                  <input type="file" multiple accept=".xml" onChange={onFileChange} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                  {files.length > 0 && (
                    <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                      <div>📦 <b>{files.length}</b> XMLs · {totalMB} MB no disco</div>
                      <div>⚡ Vai virar {Math.ceil(files.length / CHUNK_JSON)} lote(s) JSON de ~{Math.min(files.length, CHUNK_JSON)} notas</div>
                    </div>
                  )}
                </div>
                <button
                  onClick={uploadCompleto}
                  disabled={running || files.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md font-medium"
                >
                  {running ? "Processando..." : `⚡ Processar ${files.length} XMLs`}
                </button>
              </div>
            </div>

          </div>

          <div className="mt-4 text-xs text-slate-400">
            💡 Precisa popular dados fictícios pra teste interno? Vá em{" "}
            <a href="/setup" className="text-slate-600 underline">/setup</a>.
          </div>

          {progresso && (
            <div className="mt-6 bg-white border border-indigo-200 rounded-lg p-4">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{progresso.fase}</span>
                <span>{progresso.atual}/{progresso.total} · {Math.round((progresso.atual / progresso.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${(progresso.atual / progresso.total) * 100}%` }} />
              </div>
            </div>
          )}

          {erroGeral && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-5">
              <h3 className="font-semibold text-red-900 mb-2">❌ Erro</h3>
              <p className="text-sm text-red-800 font-mono whitespace-pre-wrap">{erroGeral}</p>
              <div className="mt-4 text-xs text-red-700 space-y-1 border-t border-red-200 pt-3">
                <p><b>Diagnóstico:</b></p>
                <p>• Se o erro persistir na Vercel, considere o <b>Plano B++</b> (Railway/Fly.io — sem limite de request/timeout). Veja <code className="bg-red-100 px-1">DEPLOY.md</code> no repositório.</p>
                <p>• Verifique também <a href="/setup" className="underline">/setup</a> para conferir se as tabelas existem no banco.</p>
              </div>
            </div>
          )}

          {resumo && !erroGeral && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-5">
              <h3 className="font-semibold text-emerald-900 mb-2">✅ Contabilização concluída</h3>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>📄 Notas <b>ÚNICAS AUTORIZADAS</b> processadas: <b>{resumo.processadas.toLocaleString("pt-BR")}</b></li>
                {resumo.dedup_canceladas > 0 && (
                  <li className="text-orange-700 bg-orange-50 px-2 py-1 rounded">
                    🚫 <b>{resumo.dedup_canceladas.toLocaleString("pt-BR")}</b> NF-e canceladas/denegadas (cStat ≠ 100/150) — EXCLUÍDAS do faturamento e da apuração de impostos. Isso é o comportamento correto conforme SEFAZ.
                  </li>
                )}
                {(resumo.dedup_no_lote > 0 || resumo.dedup_no_banco > 0) && (
                  <li className="text-amber-700 bg-amber-50 px-2 py-1 rounded">
                    ⚠️ <b>Deduplicação:</b> de {resumo.dedup_recebidas.toLocaleString("pt-BR")} XMLs recebidos,
                    {" "}<b>{resumo.dedup_no_lote.toLocaleString("pt-BR")}</b> duplicados no próprio lote
                    {resumo.dedup_no_banco > 0 && <> e <b>{resumo.dedup_no_banco.toLocaleString("pt-BR")}</b> já existiam no banco</>}
                    . Normal — pastas do SEFAZ trazem 2-3 XMLs por NF (autorização + eventos).
                  </li>
                )}
                <li>📝 Lançamentos totais: <b>{resumo.lancamentos.toLocaleString("pt-BR")}</b></li>
                {resumo.tempoParseMs > 0 && (
                  <li>🔍 Parse no navegador: <b>{resumo.tempoParseMs.toLocaleString("pt-BR")} ms</b> ({(resumo.tempoParseMs / Math.max(1, resumo.processadas)).toFixed(1)} ms/nota)</li>
                )}
                <li>💾 Contabilização no servidor: <b>{resumo.tempoMs.toLocaleString("pt-BR")} ms</b></li>
                {regime === "SIMPLES" && resumo.rbt12 > 0 && (
                  <li>💰 RBT12 {resumo.rbt12Estimado ? "estimado" : "informado"}: R$ {resumo.rbt12.toLocaleString("pt-BR")} → alíquota efetiva <b>{(resumo.aliqEfetiva * 100).toFixed(4)}%</b></li>
                )}
                <li>🔍 Auditoria R08: <b>{resumo.auditR08Erros}</b> erros · R$ {resumo.auditR08Credito.toLocaleString("pt-BR")} recuperável</li>
                {resumo.parseErros.length > 0 && (
                  <li>⚠️ {resumo.parseErros.length} XML(s) com erro de parse (ignorados)</li>
                )}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="/" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md">Dashboard</a>
                <a href="/analise-ia" className="text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-md font-medium">🤖 Analisar com IA</a>
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
