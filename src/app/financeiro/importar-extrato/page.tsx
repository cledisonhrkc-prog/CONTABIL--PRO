"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

interface ContaBancaria {
  id: number;
  nome: string;
  banco?: string;
}

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = reader.result as string;
      // Remove o prefixo "data:...;base64," se vier junto
      const base64 = resultado.includes(",") ? resultado.split(",")[1] : resultado;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadExtratoPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/financeiro/contas-bancarias")
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : data?.value || data?.contas || [];
        setContas(lista);
      })
      .catch(() => {});
  }, []);

  async function enviar() {
    setErro("");
    setResultado(null);
    if (!contaBancariaId) {
      setErro("Selecione a conta bancária.");
      return;
    }
    if (!arquivo) {
      setErro("Escolha um arquivo .ofx ou .xlsx.");
      return;
    }

    const extensao = arquivo.name.split(".").pop()?.toLowerCase();
    setEnviando(true);
    try {
      const base64 = await arquivoParaBase64(arquivo);
      let url: string;
      let body: any;

      if (extensao === "ofx") {
        url = "/api/financeiro/conciliacao/importar-ofx";
        // OFX é texto — o backend espera o conteúdo puro, não base64
        const conteudoOfx = atob(base64);
        body = { contaBancariaId: Number(contaBancariaId), conteudoOfx };
      } else if (extensao === "xlsx" || extensao === "xls") {
        url = "/api/financeiro/conciliacao/importar-excel";
        body = { contaBancariaId: Number(contaBancariaId), arquivoBase64: base64 };
      } else {
        throw new Error("Formato não suportado — use .ofx, .xlsx ou .xls.");
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao importar arquivo.");
      setResultado(data);
      setArquivo(null);
    } catch (e: any) {
      setErro(e.message || "Erro ao importar arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importar Extrato Bancário</h1>
          <p className="text-sm text-slate-500">Formatos aceitos: .ofx (banco) ou .xlsx/.xls (Excel)</p>
        </div>
        <Link href="/financeiro" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="text-sm text-slate-500 block mb-1">Conta bancária</label>
          <select
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            value={contaBancariaId}
            onChange={(e) => setContaBancariaId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.banco ? `— ${c.banco}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-500 block mb-1">Arquivo (.ofx, .xlsx ou .xls)</label>
          <input
            type="file"
            accept=".ofx,.xlsx,.xls"
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          onClick={enviar}
          disabled={enviando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {enviando ? "Importando..." : "Importar"}
        </button>
      </div>

      {resultado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          <p className="font-semibold mb-1">Importação concluída!</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(resultado, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
