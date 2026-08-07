"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";

type Estado = { loading: boolean; texto: string; erro: string; copiado: boolean; };

export default function AnaliseIAPage() {
  const [estado, setEstado] = useState<Estado>({ loading: true, texto: "", erro: "", copiado: false });
  const [analiseClaude, setAnaliseClaude] = useState<string | null>(null);
  const [loadingClaude, setLoadingClaude] = useState(false);
  const [erroClaude, setErroClaude] = useState("");

  useEffect(() => {
    fetch("/api/analise-ia?formato=texto")
      .then((r) => r.text())
      .then((txt) => setEstado({ loading: false, texto: txt, erro: "", copiado: false }))
      .catch((e) => setEstado((s) => ({ ...s, loading: false, erro: String(e) })));
  }, []);

  async function analisarComClaude() {
    setLoadingClaude(true);
    setAnaliseClaude(null);
    setErroClaude("");
    try {
      const r = await fetch("/api/analise-ia?analisar=1");
      const data = await r.json();
      if (data.analise_claude) {
        setAnaliseClaude(data.analise_claude);
      } else {
        setErroClaude("Claude nao retornou analise. Verifique ANTHROPIC_API_KEY no Vercel.");
      }
    } catch (e) {
      setErroClaude("Erro: " + String(e));
    } finally {
      setLoadingClaude(false);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(estado.texto);
    setEstado((s) => ({ ...s, copiado: true }));
    setTimeout(() => setEstado((s) => ({ ...s, copiado: false })), 2000);
  }

  if (estado.loading) return <AppLayout><div className="p-8 text-slate-500">Carregando...</div></AppLayout>;
  if (estado.erro) return <AppLayout><div className="p-8 text-red-600">Erro: {estado.erro}</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        <h1 className="text-2xl font-bold text-slate-800">Analisar com IA</h1>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <h2 className="font-bold text-orange-900 mb-1">Analise Automatica com Claude</h2>
          <p className="text-sm text-orange-700 mb-4">O sistema envia os dados ao Claude e traz a analise aqui automaticamente.</p>
          <button
            onClick={analisarComClaude}
            disabled={loadingClaude}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-lg font-bold text-sm"
          >
            {loadingClaude ? "Analisando... aguarde 15s" : "Analisar com Claude agora"}
          </button>
          {erroClaude && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{erroClaude}</div>}
          {analiseClaude && (
            <div className="mt-4 p-4 bg-white border border-orange-200 rounded-lg">
              <h3 className="font-bold text-slate-800 mb-3 text-sm">PARECER DO CLAUDE</h3>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{analiseClaude}</div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-800 mb-2">Dossie Manual</h2>
          <p className="text-sm text-slate-500 mb-4">Cole em qualquer IA para analise personalizada.</p>
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={copiar} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium">
              {estado.copiado ? "Copiado!" : "Copiar dossie"}
            </button>
            <a href="/api/analise-ia?formato=download" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-medium">
              Baixar .md
            </a>
          </div>
          <textarea readOnly value={estado.texto} className="w-full h-64 text-xs font-mono border border-slate-200 rounded p-3 bg-slate-50 resize-none" />
        </div>
      </div>
    </AppLayout>
  );
}