"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Diag = {
  ok: boolean;
  passo: string;
  detalhes: Record<string, unknown>;
  proxima_acao?: string;
  tempo_ms: number;
};

export default function SetupPage() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [seeding, setSeeding] = useState(false);

  async function rodarDiag() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/diagnostico");
      const j = await r.json();
      setDiag(j);
    } catch (e) {
      setMsg("Erro na conexão: " + (e as Error).message);
    }
    setLoading(false);
  }

  async function autoCriar() {
    setLoading(true);
    setMsg("Criando tabelas no Supabase...");
    try {
      const r = await fetch("/api/diagnostico?auto=1", { method: "POST" });
      const j = await r.json();
      setMsg(j.ok ? "✅ Tabelas criadas com sucesso!" : "❌ " + (j.erro ?? "falhou"));
      await rodarDiag();
    } catch (e) {
      setMsg("Erro: " + (e as Error).message);
    }
    setLoading(false);
  }

  async function seedDemo(qtd: number) {
    setSeeding(true);
    setMsg(`Gerando ${qtd} notas fiscais fictícias (~${Math.ceil(qtd / 300)}s)...`);
    try {
      const r = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtd, regime: "SIMPLES", anexo: "I", rbt12: 600000, ano_inicio: 2025, ano_fim: 2027 }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(`✅ ${j.result.lotesProcessados} notas processadas em ${j.result.tempoMs}ms. Redirecionando...`);
        setTimeout(() => (window.location.href = "/"), 1500);
      } else {
        setMsg("❌ " + (j.error ?? "falhou"));
      }
    } catch (e) {
      setMsg("Erro: " + (e as Error).message);
    }
    setSeeding(false);
  }

  useEffect(() => {
    rodarDiag();
  }, []);

  const contagens = (diag?.detalhes?.contagens ?? {}) as Record<string, number>;
  const tabelasFaltando = (diag?.detalhes?.tabelas_faltando ?? []) as string[];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-xl">C</div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">SIGC Contábil Pro</h1>
            <p className="text-sm text-slate-500">Setup & Diagnóstico do Sistema</p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500 mt-3">Verificando...</p>
          </div>
        )}

        {msg && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">{msg}</div>
        )}

        {diag && !loading && (
          <div className="space-y-4">
            {/* Status geral */}
            <div className={`p-4 rounded-lg border ${diag.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{diag.ok ? "✅" : "❌"}</span>
                <span className="font-bold text-slate-800">
                  {diag.ok ? "Sistema operacional" : "Configuração incompleta"}
                </span>
                <span className="ml-auto text-xs text-slate-500">{diag.tempo_ms}ms</span>
              </div>
                <p className="text-sm text-slate-700">Último passo: {String(diag.passo)}</p>
              {diag.proxima_acao ? (
                <p className="text-sm text-slate-600 mt-2"><b>Próxima ação:</b> {String(diag.proxima_acao)}</p>
              ) : null}
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-sm">
              <ChecklistItem label="DATABASE_URL configurada" ok={!!diag.detalhes.database_url_configurada} />
              <ChecklistItem label="Conexão com Postgres funciona" ok={!!diag.detalhes.conexao_ok} />
              <ChecklistItem label="Tabelas criadas no banco" ok={tabelasFaltando.length === 0 && !!diag.detalhes.conexao_ok} />
              <ChecklistItem label="Plano de contas populado" ok={(contagens.plano_contas ?? 0) > 0} />
              <ChecklistItem label="Empresa cadastrada" ok={(contagens.empresas ?? 0) > 0} />
            </div>

            {/* Tabelas faltando */}
            {tabelasFaltando.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-4">
                <p className="text-sm font-medium text-amber-900 mb-2">
                  ⚠️ Faltam {tabelasFaltando.length} tabelas no banco: {tabelasFaltando.join(", ")}
                </p>
                <button
                  onClick={autoCriar}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium text-sm"
                >
                  🔧 CRIAR TABELAS AUTOMATICAMENTE (Auto-Setup)
                </button>
              </div>
            )}

            {/* Empresa não cadastrada mas banco OK */}
            {tabelasFaltando.length === 0 && (contagens.empresas ?? 0) === 0 && !!diag.detalhes.conexao_ok && (
              <div className="bg-indigo-50 border border-indigo-200 rounded p-4">
                <p className="text-sm font-medium text-indigo-900 mb-3">
                  💡 Banco pronto! Popular com dados fictícios para testar:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => seedDemo(200)} disabled={seeding} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm">
                    ⚡ 200 notas (rápido)
                  </button>
                  <button onClick={() => seedDemo(500)} disabled={seeding} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm">
                    500 notas
                  </button>
                  <button onClick={() => seedDemo(1000)} disabled={seeding} className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-sm">
                    1000 notas (recomendado)
                  </button>
                </div>
                <p className="text-xs text-indigo-700 mt-2">
                  Distribuídas em 2025-2027 para testar Pré-Reforma, Transição e Reforma Tributária.
                </p>
              </div>
            )}

            {/* Contagens */}
            {Object.keys(contagens).length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600 font-medium">📊 Ver contagem por tabela</summary>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {Object.entries(contagens).map(([t, c]) => (
                    <div key={t} className="bg-slate-50 rounded p-2 text-xs">
                      <div className="text-slate-500">{t}</div>
                      <div className="font-bold text-slate-800">{c.toLocaleString("pt-BR")}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Debug info */}
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500">🔍 Detalhes técnicos (JSON)</summary>
              <pre className="mt-2 bg-slate-900 text-slate-100 rounded p-3 overflow-x-auto text-[10px]">
                {JSON.stringify(diag, null, 2)}
              </pre>
            </details>

            <div className="pt-4 border-t border-slate-200 flex gap-2 justify-between">
              <button onClick={rodarDiag} className="text-sm text-slate-600 hover:text-slate-800">
                🔄 Re-verificar
              </button>
              <Link href="/" className="text-sm bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900">
                Ir para o Dashboard →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-slate-700">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${ok ? "bg-emerald-500" : "bg-slate-300"}`}>
        {ok ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </div>
  );
}
