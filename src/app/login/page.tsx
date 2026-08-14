"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro("");
    setCarregando(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    setCarregando(false);
    if (!data.ok) {
      setErro(data.mensagem || "Erro ao entrar.");
      return;
    }
    const destino = params.get("redirect") || "/";
    router.push(destino);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold">
            C
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">CONTÁBIL PRO</div>
            <div className="text-[10px] text-slate-500">Acesso restrito</div>
          </div>
        </div>

        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm mb-3"
          placeholder="voce@escritorio.com.br"
        />

        <label className="block text-xs font-medium text-slate-600 mb-1">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm mb-4"
          placeholder="••••••••"
        />

        {erro && <div className="text-xs text-red-600 mb-3">{erro}</div>}

        <button
          onClick={entrar}
          disabled={carregando || !email || !senha}
          className="w-full bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-40"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
