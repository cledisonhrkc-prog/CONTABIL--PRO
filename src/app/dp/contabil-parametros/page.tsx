"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Search } from "lucide-react";

export const dynamic = "force-dynamic";

interface Conta {
  codigo: string;
  descricao: string;
  tipo: string;
  natureza: string;
}

export default function ContabilParametrosPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregandoContas, setCarregandoContas] = useState(true);
  const [contaDebitoDespesa, setContaDebitoDespesa] = useState("");
  const [contaCreditoInssPassivo, setContaCreditoInssPassivo] = useState("");
  const [contaCreditoFgtsPassivo, setContaCreditoFgtsPassivo] = useState("");
  const [contaCreditoIrrfPassivo, setContaCreditoIrrfPassivo] = useState("");
  const [contaCreditoSalariosAPagar, setContaCreditoSalariosAPagar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/dp/buscar-plano-contas")
      .then((r) => r.json())
      .then((data) => {
        // Prioriza as contas relacionadas a folha, mas mostra todas as de nível 4
        const relacionadas = data.candidatos_relacionados_a_folha || [];
        const todas = data.todas_contas_nivel_4 || [];
        // Junta sem duplicar
        const codigosRelacionados = new Set(relacionadas.map((c: Conta) => c.codigo));
        const resto = todas.filter((c: Conta) => !codigosRelacionados.has(c.codigo));
        setContas([...relacionadas, ...resto]);
      })
      .catch(() => setErro("Erro ao buscar plano de contas."))
      .finally(() => setCarregandoContas(false));
  }, []);

  async function salvar() {
    if (
      !contaDebitoDespesa ||
      !contaCreditoInssPassivo ||
      !contaCreditoFgtsPassivo ||
      !contaCreditoIrrfPassivo ||
      !contaCreditoSalariosAPagar
    ) {
      setErro("Preencha todas as 5 contas antes de salvar.");
      return;
    }
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const res = await fetch("/api/dp/contabil-parametros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contaDebitoDespesa,
          contaCreditoInssPassivo,
          contaCreditoFgtsPassivo,
          contaCreditoIrrfPassivo,
          contaCreditoSalariosAPagar,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar.");
      setMensagem(
        "Salvo! A partir de agora, todo processamento de folha vai gerar lançamento contábil automaticamente com essas contas."
      );
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function SeletorConta({
    label,
    valor,
    onChange,
  }: {
    label: string;
    valor: string;
    onChange: (v: string) => void;
  }) {
    return (
      <div>
        <label className="text-sm text-slate-500 block mb-1">{label}</label>
        <select
          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione a conta...</option>
          {contas.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} — {c.descricao}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integração Contábil da Folha</h1>
          <p className="text-sm text-slate-500">
            Escolha quais contas do plano de contas recebem os lançamentos automáticos de folha
          </p>
        </div>
        <Link href="/dp" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Atenção:</strong> se as contas de folha ainda não existirem no seu plano de contas,
        elas aparecem como código provisório na lista abaixo. Confirme com um contador antes de considerar
        definitivo pra declaração fiscal.
      </div>

      {carregandoContas ? (
        <p className="text-sm text-slate-400">Carregando plano de contas...</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <SeletorConta
            label="Débito — Despesa com Pessoal (proventos + encargos do empregador)"
            valor={contaDebitoDespesa}
            onChange={setContaDebitoDespesa}
          />
          <SeletorConta
            label="Crédito — INSS a Recolher (empregado + patronal)"
            valor={contaCreditoInssPassivo}
            onChange={setContaCreditoInssPassivo}
          />
          <SeletorConta
            label="Crédito — FGTS a Recolher"
            valor={contaCreditoFgtsPassivo}
            onChange={setContaCreditoFgtsPassivo}
          />
          <SeletorConta
            label="Crédito — IRRF a Recolher"
            valor={contaCreditoIrrfPassivo}
            onChange={setContaCreditoIrrfPassivo}
          />
          <SeletorConta
            label="Crédito — Salários a Pagar (líquido ainda não desembolsado)"
            valor={contaCreditoSalariosAPagar}
            onChange={setContaCreditoSalariosAPagar}
          />

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {mensagem && <p className="text-sm text-emerald-700">{mensagem}</p>}

          <button
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : "Salvar configuração"}
          </button>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-500 flex items-start gap-2">
        <Search className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Se as contas certas ainda não existem, use o setup{" "}
          <code className="bg-slate-200 px-1 rounded">/api/dp/criar-contas-folha</code> primeiro pra criar
          as 5 contas provisórias, depois volte aqui pra selecionar.
        </span>
      </div>
    </div>
  );
}
