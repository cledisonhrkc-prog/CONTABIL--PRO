"use client";

import { useState } from "react";

export default function BotaoDeletarCliente({
  cnpj,
  nome,
}: {
  cnpj: string;
  nome: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function deletar() {
    setRodando(true);
    setMsg("");
    try {
      const r = await fetch(
        `/api/diagnostico?delete_empresa=${encodeURIComponent(cnpj)}`,
        { method: "POST" }
      );
      const data = await r.json();
      if (data.ok) {
        setMsg("Cliente removido. Redirecionando...");
        setTimeout(() => {
          window.location.href = "/importar";
        }, 1500);
      } else {
        setMsg("Erro: " + (data.erro ?? "falha ao remover"));
        setRodando(false);
      }
    } catch (e) {
      setMsg("Erro de rede: " + String(e));
      setRodando(false);
    }
  }

  return (
    <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="font-semibold text-red-900 mb-1">Zona de perigo</h3>
      <p className="text-xs text-red-800 mb-3">
        Remove <b>somente</b> este cliente ({nome}) e todos os dados dele
        (notas, itens, lançamentos, apuração). Os demais clientes e o plano de
        contas são preservados. Esta ação não pode ser desfeita.
      </p>

      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="px-4 py-2 bg-white border border-red-300 hover:bg-red-100 text-red-700 rounded-md text-sm font-medium"
        >
          Deletar este cliente
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-red-900 font-medium">
            Tem certeza? Isso apaga tudo de {nome}.
          </span>
          <button
            onClick={deletar}
            disabled={rodando}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-md text-sm font-bold"
          >
            {rodando ? "Removendo..." : "Sim, deletar"}
          </button>
          <button
            onClick={() => setConfirmando(false)}
            disabled={rodando}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-sm"
          >
            Cancelar
          </button>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-red-900 font-medium">{msg}</p>}
    </div>
  );
}
