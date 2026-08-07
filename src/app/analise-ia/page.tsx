"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Link from "next/link";

type Estado = {
  loading: boolean;
  texto: string;
  jsonPreview: string;
  erro: string;
  copiado: boolean;
};

// Prompts prontos pra cada IA (clique e abre com o dossiê pré-carregado)
const IAs = [
  { nome: "ChatGPT", url: "https://chatgpt.com/", cor: "bg-emerald-600", icon: "🤖" },
  { nome: "Claude", url: "https://claude.ai/new", cor: "bg-orange-600", icon: "🧠" },
  { nome: "Gemini", url: "https://gemini.google.com/", cor: "bg-blue-600", icon: "✨" },
  { nome: "Grok", url: "https://grok.com/", cor: "bg-slate-800", icon: "𝕏" },
  { nome: "Perplexity", url: "https://www.perplexity.ai/", cor: "bg-cyan-600", icon: "🔍" },
  { nome: "Copilot", url: "https://copilot.microsoft.com/", cor: "bg-indigo-600", icon: "💠" },
];

const PROMPTS_SUGERIDOS = [
  { titulo: "Análise fiscal geral", texto: "Analise este dossiê contábil-fiscal e identifique inconsistências, riscos tributários e oportunidades de economia. Seja específico com valores." },
  { titulo: "Impacto da Reforma 2027", texto: "Baseado neste dossiê, calcule o impacto financeiro da Reforma Tributária (EC 132/2023) para esta empresa em 2027, 2029 e 2033. Ela ganha ou perde? Recomende ações preparatórias." },
  { titulo: "Planejamento tributário", texto: "Esta empresa está no melhor regime tributário possível? Compare Simples, Presumido e Lucro Real para o perfil dela e recomende migração se aplicável." },
  { titulo: "Auditoria PIS/COFINS monofásico", texto: "Analise as divergências da regra R08 (monofásico PIS/COFINS) e me diga quais são legítimas para PER/DCOMP, com os artigos das Leis 10.147/2000 e 10.485/2002." },
  { titulo: "Parecer executivo", texto: "Produza um parecer executivo de 1 página com: (1) situação atual, (2) 3 principais riscos, (3) 3 principais oportunidades, (4) plano de ação de 90 dias." },
];

export default function AnaliseIAPage() {
  const [estado, setEstado] = useState<Estado>({
    loading: true,
    texto: "",
    jsonPreview: "",
    erro: "",
    copiado: false,
  });
  const [promptSelecionado, setPromptSelecionado] = useState(PROMPTS_SUGERIDOS[0].texto);

  async function carregar() {
    setEstado((s) => ({ ...s, loading: true, erro: "" }));
    try {
      const [txtR, jsonR] = await Promise.all([
        fetch("/api/analise-ia?formato=texto").then((r) => r.text()),
        fetch("/api/analise-ia?formato=json").then((r) => r.json()),
      ]);
      setEstado({
        loading: false,
        texto: txtR,
        jsonPreview: JSON.stringify(jsonR.dossie ?? jsonR, null, 2),
        erro: jsonR.ok === false ? jsonR.error ?? "" : "",
        copiado: false,
      });
    } catch (e) {
      setEstado((s) => ({ ...s, loading: false, erro: (e as Error).message }));
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function copiar(conteudo: string) {
    try {
      await navigator.clipboard.writeText(conteudo);
      setEstado((s) => ({ ...s, copiado: true }));
      setTimeout(() => setEstado((s) => ({ ...s, copiado: false })), 2500);
    } catch {
      alert("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  const textoCompleto =
    promptSelecionado.trim() +
    "\n\n---\n\n" +
    estado.texto;

  const tokens = Math.ceil(textoCompleto.length / 4); // estimativa

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🤖</span>
              <h1 className="text-2xl font-bold text-slate-800">Analisar com IA</h1>
            </div>
            <p className="text-sm text-slate-500">
              Dossiê completo dos dados contábeis-fiscais consolidados, pronto para colar em qualquer IA
              (ChatGPT, Claude, Gemini, etc.) e pedir análise, parecer ou recomendações.
            </p>
          </div>

          {estado.loading && (
            <div className="text-center py-16">
              <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 mt-3">Consolidando dados...</p>
            </div>
          )}

          {estado.erro && !estado.loading && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
              ❌ {estado.erro} — <Link href="/importar" className="underline">Importe XMLs primeiro</Link>.
            </div>
          )}

          {!estado.loading && !estado.erro && (
            <>
              {/* Passo 1: escolher prompt */}
              <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
                <h2 className="font-semibold text-slate-800 mb-3">
                  <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 inline-flex items-center justify-center mr-2">1</span>
                  Escolha ou personalize o prompt de análise
                </h2>
                <div className="grid md:grid-cols-2 gap-2 mb-3">
                  {PROMPTS_SUGERIDOS.map((p) => (
                    <button
                      key={p.titulo}
                      onClick={() => setPromptSelecionado(p.texto)}
                      className={`text-left px-3 py-2 rounded text-sm border transition ${
                        promptSelecionado === p.texto
                          ? "bg-indigo-50 border-indigo-500 text-indigo-900"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-medium">{p.titulo}</div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.texto}</div>
                    </button>
                  ))}
                </div>
                <textarea
                  value={promptSelecionado}
                  onChange={(e) => setPromptSelecionado(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
                  placeholder="Ou escreva sua pergunta customizada aqui..."
                />
              </section>

              {/* Passo 2: copiar tudo */}
              <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
                <h2 className="font-semibold text-slate-800 mb-3">
                  <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 inline-flex items-center justify-center mr-2">2</span>
                  Copie o dossiê completo (prompt + dados)
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => copiar(textoCompleto)}
                    className={`px-5 py-2.5 rounded-md font-medium text-sm transition ${
                      estado.copiado
                        ? "bg-emerald-600 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {estado.copiado ? "✅ Copiado!" : "📋 Copiar tudo para o clipboard"}
                  </button>
                  <a
                    href="/api/analise-ia?formato=download"
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-sm"
                  >
                    💾 Baixar como .md
                  </a>
                  <button
                    onClick={() => copiar(estado.jsonPreview)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-sm"
                  >
                    🧾 Copiar como JSON
                  </button>
                  <div className="ml-auto text-xs text-slate-500 self-center">
                    📏 {textoCompleto.length.toLocaleString("pt-BR")} caracteres · ~{tokens.toLocaleString("pt-BR")} tokens
                  </div>
                </div>
                <details>
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                    👁️ Ver prévia do texto que será copiado
                  </summary>
                  <pre className="mt-2 bg-slate-900 text-slate-100 rounded p-3 text-[10px] max-h-96 overflow-auto whitespace-pre-wrap">
                    {textoCompleto}
                  </pre>
                </details>
              </section>

              {/* Passo 3: abrir a IA */}
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="font-semibold text-slate-800 mb-3">
                  <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 inline-flex items-center justify-center mr-2">3</span>
                  Abra a IA de sua preferência e cole (Ctrl+V ou Cmd+V)
                </h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {IAs.map((ia) => (
                    <a
                      key={ia.nome}
                      href={ia.url}
                      target="_blank"
                      rel="noopener"
                      className={`${ia.cor} text-white rounded-lg p-4 flex flex-col items-center gap-1 hover:opacity-90 transition`}
                    >
                      <span className="text-2xl">{ia.icon}</span>
                      <span className="text-xs font-medium">{ia.nome}</span>
                    </a>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  💡 Dica: modelos com maior janela de contexto (Claude Sonnet 4.5, Gemini 2.5, GPT-5) processam melhor dossiês grandes.
                </p>
              </section>

              <button
                onClick={carregar}
                className="mt-4 text-xs text-slate-500 hover:text-slate-800"
              >
                🔄 Recarregar dados
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
