"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { parseNfeXml, type NF } from "@/lib/nfe-parser";
import { preValidar, formatarPreValidacaoTexto, type PreValidacaoResumo } from "@/lib/pre-validacao";
import JSZip from "jszip";

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

  // Pré-validação por IA (bloqueia contabilização)
  const [preValidacao, setPreValidacao] = useState<PreValidacaoResumo | null>(null);
  const [textoIA, setTextoIA] = useState<string>("");
  const [nfsParaContabilizar, setNfsParaContabilizar] = useState<NF[] | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [analiseClaude, setAnaliseClaude] = useState<string | null>(null);
  const [loadingClaude, setLoadingClaude] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return setFiles([]);
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    setFiles(arr);
    setErroGeral("");
    setResumo(null);
  }

  // Parse local — MUITO rápido, tudo em memória do navegador
  async function parseArquivosLocal(): Promise<{ nfs: NF[]; erros: Array<{ arquivo: string; erro: string }>; xmlsCrus: Array<{ nome: string; xml: string; chave: string }> }> {
    const nfs: NF[] = [];
    const erros: Array<{ arquivo: string; erro: string }> = [];
    const xmlsCrus: Array<{ nome: string; xml: string; chave: string }> = [];
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const xml = await f.text();
        const nf = parseNfeXml(xml, cnpjLimpo);
        nfs.push(nf);
        // Guarda XML cru (limitado às 5 primeiras + 5 maiores = ~10 amostras)
        // Máximo 10 KB por XML pra não estourar contexto da IA
        if (xmlsCrus.length < 20) {
          xmlsCrus.push({
            nome: f.name,
            xml: xml.substring(0, 10000),
            chave: nf.chave,
          });
        }
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
    return { nfs, erros, xmlsCrus };
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

  // PASSO 1: parse + pré-validação (NÃO contabiliza ainda — pausa pra IA revisar)
  async function preValidarLote() {
    if (files.length === 0) return alert("Selecione arquivos XML");
    setRunning(true);
    setErroGeral("");
    setResumo(null);
    setPreValidacao(null);
    setNfsParaContabilizar(null);

    const { nfs, erros: parseErros, xmlsCrus } = await parseArquivosLocal();
    if (nfs.length === 0) {
      setErroGeral(`Nenhum XML válido. ${parseErros.length} arquivo(s) com erro de parse.`);
      setRunning(false);
      setProgresso(null);
      return;
    }

    setProgresso({ fase: "🔍 Executando pré-validação estruturada...", atual: 1, total: 1 });
    const pv = preValidar(nfs, xmlsCrus);
    const texto = formatarPreValidacaoTexto(pv);
    setPreValidacao(pv);
    setTextoIA(texto);
    setNfsParaContabilizar(nfs);
    setRunning(false);
    setProgresso(null);
    setAnaliseClaude(null);
    setLoadingClaude(true);
    try {
      const rIA = await fetch("/api/analise-ia?analisar=1");
      const dataIA = await rIA.json();
      setAnaliseClaude(dataIA.analise_claude ?? "Sem retorno da IA.");
    } catch (eIA) {
      setAnaliseClaude("Erro ao chamar a IA: " + String(eIA));
    }
    setLoadingClaude(false);
    // Auto-copia o dossiê pra área de transferência assim que a validação termina
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // silencioso — se falhar, usuário pode clicar no botão manualmente
    }
  }

  // PASSO 2: contabilizar APÓS aprovação humana da pré-validação
  async function contabilizarAgora() {
    const nfs = nfsParaContabilizar;
    if (!nfs || nfs.length === 0) return;
    setRunning(true);
    setErroGeral("");

    const totalChunks = Math.ceil(nfs.length / CHUNK_JSON);
    const acumulado: UploadLote = {
      processadas: 0,
      parseErros: [],
      lancamentos: 0,
      tempoMs: 0,
      tempoParseMs: 0,
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
        fase: `📤 Contabilizando (lote ${i + 1}/${totalChunks})`,
        atual: i + 1,
        total: totalChunks,
      });
      const r = await enviarLoteJson(chunk);
      if (!r.ok) {
        setErroGeral(`Falhou no lote ${i + 1}: ${r.error}`);
        setRunning(false);
        setProgresso(null);
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
    setPreValidacao(null);
    setNfsParaContabilizar(null);
    setRunning(false);
    setProgresso(null);
  }

  async function copiarTextoIA() {
    try {
      await navigator.clipboard.writeText(textoIA);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      alert("Não conseguiu copiar. Selecione manualmente.");
    }
  }

  // Empacota TODOS os XMLs num único .zip e força download.
  // Usuário anexa esse zip na conversa da Claude (arrasta pro chat).
  const [zipando, setZipando] = useState(false);
  async function baixarZipCompleto() {
    if (files.length === 0) return alert("Selecione os XMLs primeiro.");
    setZipando(true);
    try {
      const zip = new JSZip();
      for (const f of files) {
        zip.file(f.name, f);
      }
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xmls_para_claude_${new Date().toISOString().substring(0, 10)}_${files.length}notas.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Falha ao gerar zip: " + (e as Error).message);
    }
    setZipando(false);
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
                  onClick={preValidarLote}
                  disabled={running || files.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md font-medium"
                >
                  {running ? "Analisando..." : `🔍 PASSO 1: Pré-validar ${files.length} XMLs (antes de contabilizar)`}
                </button>
                <p className="text-[11px] text-slate-500 mt-2">
                  Vai parsear os XMLs no navegador e gerar um dossiê estruturado para você mandar
                  na IA (ChatGPT/Claude/Gemini) analisar ANTES da contabilização. Nenhum dado é
                  gravado ainda.
                </p>

                {/* Atalho: baixar zip com TODOS os XMLs pra anexar no Claude */}
                {files.length > 0 && (
                  <button
                    onClick={baixarZipCompleto}
                    disabled={zipando}
                    className="w-full mt-2 py-2 bg-orange-100 hover:bg-orange-200 disabled:bg-slate-100 text-orange-800 rounded-md font-medium text-xs border border-orange-300"
                  >
                    {zipando ? "🗜️ Gerando..." : `📦 Baixar .zip com TODOS os ${files.length} XMLs (pra arrastar no Claude Pro)`}
                  </button>
                )}
              </div>
            </div>

          </div>

          <div className="mt-4 text-xs text-slate-400">
            💡 Precisa popular dados fictícios pra teste interno? Vá em{" "}
            <a href="/setup" className="text-slate-600 underline">/setup</a>.
          </div>

          {preValidacao && !running && (
            <div className="mt-6 space-y-4">
              {/* Alerta topo */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg p-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔍</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">PASSO 1 concluído — Dossiê + XMLs JÁ COPIADOS para a Claude</h2>
                    <p className="text-sm text-purple-100">
                      Os {preValidacao.total_xmls_recebidos} XMLs foram parseados. <b>O dossiê completo (com {preValidacao.amostra_xmls_crus.length} XMLs brutos de amostra) já está na sua área de transferência.</b> Clique no botão laranja abaixo para abrir a Claude AI e cole com Ctrl+V. Nenhum dado foi gravado no banco ainda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Resumo visual da pré-validação */}
              <div className="grid md:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded p-3">
                  <div className="text-[10px] text-slate-500 font-bold">XMLs RECEBIDOS</div>
                  <div className="text-2xl font-bold text-slate-800">{preValidacao.total_xmls_recebidos}</div>
                </div>
                <div className="bg-white border border-emerald-200 rounded p-3">
                  <div className="text-[10px] text-emerald-700 font-bold">NOTAS VÁLIDAS ÚNICAS</div>
                  <div className="text-2xl font-bold text-emerald-700">{preValidacao.totais_filtrados.qtd_notas_validas}</div>
                  <div className="text-[10px] text-slate-500">após dedup + filtro cStat</div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-3">
                  <div className="text-[10px] text-slate-500 font-bold">FATURAMENTO LÍQUIDO</div>
                  <div className="text-lg font-bold text-slate-800">R$ {preValidacao.totais_filtrados.faturamento_liquido_st.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
                <div className={`bg-white border rounded p-3 ${preValidacao.alertas.filter(a => a.severidade === "ERRO").length > 0 ? "border-red-300" : "border-slate-200"}`}>
                  <div className="text-[10px] text-slate-500 font-bold">ALERTAS</div>
                  <div className="text-2xl font-bold text-slate-800">{preValidacao.alertas.length}</div>
                  <div className="text-[10px] text-slate-500">
                    {preValidacao.alertas.filter(a => a.severidade === "ERRO").length} erros · {preValidacao.alertas.filter(a => a.severidade === "AVISO").length} avisos
                  </div>
                </div>
              </div>

              {/* Status SEFAZ */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">📋 Distribuição por Status SEFAZ (cStat)</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(preValidacao.por_status).map(([cs, qtd]) => {
                    const ok = cs === "100" || cs === "150";
                    return (
                      <div key={cs} className={`px-3 py-1.5 rounded ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                        <b>cStat {cs}:</b> {qtd} nota(s) {ok ? "✓" : "✗ excluída(s)"}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Alertas críticos */}
              {preValidacao.alertas.filter(a => a.severidade === "ERRO").length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-2">🚨 Erros críticos detectados</h3>
                  <ul className="text-xs text-red-900 space-y-1 max-h-40 overflow-y-auto">
                    {preValidacao.alertas.filter(a => a.severidade === "ERRO").slice(0, 15).map((a, i) => (
                      <li key={i}>• <b>[{a.categoria}]</b> {a.nota}: {a.descricao}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* BOTÃO PRINCIPAL: Enviar direto pra Claude (destaque máximo) */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg p-5 shadow-lg">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-4xl">🧠</span>
                  <div className="flex-1 text-white">
                    <h3 className="text-lg font-bold">Enviar direto pra Claude AI</h3>
                    <p className="text-sm text-orange-100">
                      Um clique só: copia o dossiê completo pra área de transferência E abre o Claude em nova aba. Depois é só apertar <b>Ctrl+V</b> na conversa.
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await copiarTextoIA();
                    window.open("https://claude.ai/new", "_blank", "noopener");
                  }}
                  className="w-full py-3 bg-white text-orange-700 hover:bg-orange-50 rounded-md font-bold text-base transition"
                >
                  🚀 COPIAR DOSSIÊ E ABRIR CLAUDE AGORA
                </button>
                {copiado && (
                  <p className="mt-2 text-center text-white font-medium text-sm">
                    ✅ Dossiê copiado! Vá pra aba do Claude que abriu e aperte Ctrl+V
                  </p>
                )}

                {/* Baixar TODOS os XMLs em zip pra anexar no Claude Pro */}
                <div className="mt-3 pt-3 border-t border-orange-400">
                  <p className="text-xs text-orange-100 mb-2">
                    <b>Quer enviar TODOS os {files.length} XMLs completos pra Claude analisar?</b><br />
                    Baixe o .zip abaixo e ARRASTE o arquivo pra dentro da conversa do Claude Pro (ele lê arquivos anexados).
                  </p>
                  <button
                    onClick={baixarZipCompleto}
                    disabled={zipando}
                    className="w-full py-2.5 bg-orange-900 hover:bg-orange-950 disabled:bg-slate-500 text-white rounded-md font-medium text-sm transition"
                  >
                    {zipando ? "🗜️ Gerando .zip..." : `📦 BAIXAR .ZIP COM TODOS OS ${files.length} XMLs (para anexar no Claude)`}
                  </button>
                </div>
              </div>

              {/* Outras IAs (mesmo dossiê, outros modelos) */}
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h3 className="font-semibold text-slate-800 mb-2">Ou envie para outra IA (mesmo dossiê)</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Primeiro clique &quot;Copiar dossiê&quot; abaixo, depois clique na IA da sua preferência. Cole com Ctrl+V.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={copiarTextoIA}
                    className={`px-5 py-2.5 rounded-md font-medium text-sm text-white ${copiado ? "bg-emerald-600" : "bg-purple-600 hover:bg-purple-700"}`}
                  >
                    {copiado ? "✅ Copiado!" : `📋 Copiar dossiê (${(textoIA.length / 1024).toFixed(0)} KB · ~${Math.ceil(textoIA.length / 4).toLocaleString("pt-BR")} tokens)`}
                  </button>
                  <a href="https://chatgpt.com/" target="_blank" rel="noopener" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm">🤖 ChatGPT</a>
                  <a href="https://gemini.google.com/" target="_blank" rel="noopener" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">✨ Gemini</a>
                  <a href="https://grok.com/" target="_blank" rel="noopener" className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm">𝕏 Grok</a>
                  <a href="https://www.perplexity.ai/" target="_blank" rel="noopener" className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-sm">🔍 Perplexity</a>
                  <a href="https://copilot.microsoft.com/" target="_blank" rel="noopener" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm">💠 Copilot</a>
                </div>
                <details>
                  <summary className="text-xs text-slate-500 cursor-pointer">👁️ Ver o dossiê completo (o que vai para a IA)</summary>
                  <pre className="mt-2 bg-slate-900 text-slate-100 rounded p-3 text-[10px] max-h-96 overflow-auto whitespace-pre-wrap">
                    {textoIA}
                  </pre>
                </details>
              </div>

              {/* Botão final */}
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-5">
                <h3 className="font-bold text-emerald-900 mb-2">✅ PASSO 2 — Após revisar com a IA, contabilize</h3>
                <p className="text-sm text-emerald-800 mb-3">
                  Quando a IA aprovar (ou você identificar que está OK), clique abaixo para gravar
                  {" "}<b>{preValidacao.totais_filtrados.qtd_notas_validas} notas válidas únicas</b> no banco.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={contabilizarAgora}
                    className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-sm"
                  >
                    ✅ CONTABILIZAR AGORA ({preValidacao.totais_filtrados.qtd_notas_validas} notas)
                  </button>
                  <button
                    onClick={() => { setPreValidacao(null); setNfsParaContabilizar(null); setTextoIA(""); }}
                    className="px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium text-sm"
                  >
                    ✗ Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {(loadingClaude || analiseClaude) && (
            <div className="mt-6 bg-white border-2 border-purple-300 rounded-lg p-5">
              <h3 className="font-bold text-purple-900 mb-2">Parecer da IA (Claude)</h3>
              {loadingClaude ? (
                <p className="text-sm text-slate-600">Analisando com a IA, aguarde...</p>
              ) : (
                <pre className="text-xs text-slate-800 whitespace-pre-wrap max-h-96 overflow-auto">{analiseClaude}</pre>
              )}
            </div>
          )}

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
