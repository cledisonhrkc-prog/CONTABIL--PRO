/**
 * Formulário de Baixa — Contas a Receber
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, formaPagamentoOptions } from "@/utils/format";

export default function BaixaReceberPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [conta, setConta] = useState<any>(null);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [valor, setValor] = useState("");
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10));
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [c, b] = await Promise.all([
          fetch(`/api/financeiro/contas-receber/${id}`).then((r) => r.json()),
          fetch("/api/financeiro/contas-bancarias").then((r) => r.json()),
        ]);
        setConta(c);
        setContasBancarias(b.filter((x: any) => x.ativa));
        const saldo = Number(c.valor) - Number(c.valorPago || 0);
        setValor(saldo.toFixed(2).replace(".", ","));
        if (b.length > 0) setContaBancariaId(String(b[0].id));
      } catch (e) {
        setErro("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");

    try {
      const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));
      const res = await fetch("/api/financeiro/baixar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: 24, // ajuste
          tipo: "RECEBER",
          contaId: id,
          valor: valorNum,
          dataBaixa,
          contaBancariaId: Number(contaBancariaId),
          formaPagamento,
          observacao,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao baixar");
      router.push("/financeiro/contas-receber");
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!conta) {
    return <div className="p-6">Conta não encontrada</div>;
  }

  const saldo = Number(conta.valor) - Number(conta.valorPago || 0);

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <Link href="/financeiro/contas-receber" className="text-sm text-blue-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Baixar Recebimento</h1>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
        <p><span className="text-gray-500">Cliente:</span> <strong>{conta.participante}</strong></p>
        <p><span className="text-gray-500">Vencimento:</span> {formatDate(conta.vencimento)}</p>
        <p><span className="text-gray-500">Valor original:</span> {formatCurrency(conta.valor)}</p>
        <p><span className="text-gray-500">Já recebido:</span> {formatCurrency(conta.valorPago || 0)}</p>
        <p className="text-lg font-semibold text-green-700">
          Saldo a receber: {formatCurrency(saldo)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-5">
        {erro && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{erro}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Valor a receber *</label>
          <input
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data da baixa *</label>
          <input
            type="date"
            value={dataBaixa}
            onChange={(e) => setDataBaixa(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Conta bancária *</label>
          <select
            value={contaBancariaId}
            onChange={(e) => setContaBancariaId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Selecione...</option>
            {contasBancarias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Forma de pagamento</label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            {formaPagamentoOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Processando..." : "Confirmar Recebimento"}
        </button>
      </form>
    </div>
  );
}
