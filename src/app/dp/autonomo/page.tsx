"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, Play } from "lucide-react";

export const dynamic = "force-dynamic";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Autonomo {
  id: number;
  colaborador_id: number;
  nome_completo: string;
}

export default function AutonomoPage() {
  const [autonomos, setAutonomos] = useState<Autonomo[]>([]);

  const [cpf, setCpf] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cargo, setCargo] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagemCadastro, setMensagemCadastro] = useState("");
  const [erroCadastro, setErroCadastro] = useState("");

  const [colaboradorId, setColaboradorId] = useState("");
  const [competencia, setCompetencia] = useState(mesAtual());
  const [valorBruto, setValorBruto] = useState("");
  const [aliquotaIss, setAliquotaIss] = useState("0");
  const [processando, setProcessando] = useState(false);
  const [resultadoPagamento, setResultadoPagamento] = useState<any>(null);
  const [erroPagamento, setErroPagamento] = useState("");

  function carregarLista() {
    fetch("/api/dp/autonomo-lista")
      .then((r) => r.json())
      .then((data) => setAutonomos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    carregarLista();
  }, []);

  async function cadastrar() {
    setErroCadastro("");
    setMensagemCadastro("");
    if (!cpf || !nomeCompleto || !dataAdmissao) {
      setErroCadastro("Preencha CPF, nome e data de início.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/dp/autonomo-novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, nomeCompleto, cargo, dataAdmissao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao cadastrar.");
      setMensagemCadastro("Autônomo cadastrado! O valor bruto é informado a cada pagamento (RPA).");
      setCpf("");
      setNomeCompleto("");
      setCargo("");
      setDataAdmissao("");
      carregarLista();
    } catch (e: any) {
      setErroCadastro(e.message || "Erro ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  async function processarPagamento() {
    setErroPagamento("");
    setResultadoPagamento(null);
    if (!colaboradorId || !valorBruto) {
      setErroPagamento("Selecione o autônomo e informe o valor bruto do serviço.");
      return;
    }
    setProcessando(true);
    try {
      const res = await fetch("/api/dp/folha/processar-autonomo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: Number(colaboradorId),
          competencia,
          valorBruto: Number(valorBruto),
          aliquotaIss: Number(aliquotaIss) / 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao processar pagamento.");
      setResultadoPagamento(data);
    } catch (e: any) {
      setErroPagamento(e.message || "Erro ao processar pagamento.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Autônomo / RPA</h1>
          <p className="text-sm text-slate-500">
            INSS 11% (com teto), IRRF com redutor da Lei 15.270/2025, sem FGTS
          </p>
        </div>
        <Link href="/dp" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Novo Autônomo</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">CPF</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Nome completo</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Serviço prestado</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Data de início</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
            />
          </div>
        </div>
        {erroCadastro && <p className="text-sm text-red-600">{erroCadastro}</p>}
        {mensagemCadastro && <p className="text-sm text-emerald-700">{mensagemCadastro}</p>}
        <button
          onClick={cadastrar}
          disabled={salvando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {salvando ? "Salvando..." : "Cadastrar Autônomo"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Processar Pagamento (RPA)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Autônomo</label>
            <select
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={colaboradorId}
              onChange={(e) => setColaboradorId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {autonomos.map((a) => (
                <option key={a.colaborador_id} value={a.colaborador_id}>
                  {a.nome_completo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Competência</label>
            <input
              type="month"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Valor bruto do serviço (R$)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={valorBruto}
              onChange={(e) => setValorBruto(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Alíquota ISS (%) — varia por município</label>
            <input
              type="number"
              min={0}
              max={5}
              step="0.1"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
              value={aliquotaIss}
              onChange={(e) => setAliquotaIss(e.target.value)}
            />
          </div>
        </div>
        {erroPagamento && <p className="text-sm text-red-600">{erroPagamento}</p>}
        <button
          onClick={processarPagamento}
          disabled={processando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {processando ? "Processando..." : "Processar Pagamento"}
        </button>

        {resultadoPagamento && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm space-y-1">
            <p>
              <strong>Líquido pago:</strong> R$ {Number(resultadoPagamento.total_liquido).toFixed(2)}
            </p>
            <p className="text-slate-500 text-xs">
              INSS: R$ {Number(resultadoPagamento.valor_inss).toFixed(2)} | IRRF: R${" "}
              {Number(resultadoPagamento.valor_irrf).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
