"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export const dynamic = "force-dynamic";

interface Vinculo {
  id: number;
  nome_completo: string;
  salario_base: string;
}

export default function VinculosConfigPage() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [vinculoId, setVinculoId] = useState("");
  const [possuiPericulosidade, setPossuiPericulosidade] = useState(false);
  const [numFilhosSalarioFamilia, setNumFilhosSalarioFamilia] = useState(0);
  const [valorPensaoAlimenticia, setValorPensaoAlimenticia] = useState(0);
  const [valorEmprestimoConsignado, setValorEmprestimoConsignado] = useState(0);
  const [carregandoVinculo, setCarregandoVinculo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/dp/vinculos-clt-lista")
      .then((r) => r.json())
      .then((data) => setVinculos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!vinculoId) return;
    setCarregandoVinculo(true);
    setMensagem("");
    setErro("");
    fetch(`/api/dp/vinculos-config?vinculoId=${vinculoId}`)
      .then((r) => r.json())
      .then((data) => {
        setPossuiPericulosidade(!!data.possui_periculosidade);
        setNumFilhosSalarioFamilia(Number(data.num_filhos_salario_familia ?? 0));
        setValorPensaoAlimenticia(Number(data.valor_pensao_alimenticia ?? 0));
        setValorEmprestimoConsignado(Number(data.valor_emprestimo_consignado ?? 0));
      })
      .catch(() => setErro("Erro ao carregar configurações do vínculo."))
      .finally(() => setCarregandoVinculo(false));
  }, [vinculoId]);

  async function salvar() {
    if (!vinculoId) {
      setErro("Selecione um colaborador primeiro.");
      return;
    }
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const res = await fetch("/api/dp/vinculos-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vinculoId: Number(vinculoId),
          possuiPericulosidade,
          numFilhosSalarioFamilia,
          valorPensaoAlimenticia,
          valorEmprestimoConsignado,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar.");
      setMensagem("Configurações salvas — vão valer no próximo processamento de folha desse colaborador.");
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configurações Avançadas do Vínculo</h1>
          <p className="text-sm text-slate-500">
            Periculosidade, salário família, pensão alimentícia e empréstimo consignado
          </p>
        </div>
        <Link href="/dp" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div>
          <label className="text-sm text-slate-500 block mb-1">Colaborador (CLT ou Aprendiz)</label>
          <select
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
            value={vinculoId}
            onChange={(e) => setVinculoId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {vinculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome_completo} — R$ {Number(v.salario_base).toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {vinculoId && !carregandoVinculo && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={possuiPericulosidade}
                onChange={(e) => setPossuiPericulosidade(e.target.checked)}
                className="w-4 h-4"
              />
              Possui periculosidade (adicional de 30% sobre o salário base)
            </label>

            <div>
              <label className="text-sm text-slate-500 block mb-1">
                Número de filhos elegíveis ao salário família (0 se não tem direito)
              </label>
              <input
                type="number"
                min={0}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                value={numFilhosSalarioFamilia}
                onChange={(e) => setNumFilhosSalarioFamilia(Number(e.target.value))}
              />
              <p className="text-xs text-slate-400 mt-1">
                Só é pago se o salário do colaborador for até R$ 1.980,38 (teto 2026)
              </p>
            </div>

            <div>
              <label className="text-sm text-slate-500 block mb-1">Valor mensal de pensão alimentícia (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                value={valorPensaoAlimenticia}
                onChange={(e) => setValorPensaoAlimenticia(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-sm text-slate-500 block mb-1">Valor mensal de empréstimo consignado (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                value={valorEmprestimoConsignado}
                onChange={(e) => setValorEmprestimoConsignado(Number(e.target.value))}
              />
              <p className="text-xs text-slate-400 mt-1">
                Limitado automaticamente a 35% do salário líquido, mesmo se digitar valor maior
              </p>
            </div>
          </>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {mensagem && <p className="text-sm text-emerald-700">{mensagem}</p>}

        <button
          onClick={salvar}
          disabled={!vinculoId || salvando}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
