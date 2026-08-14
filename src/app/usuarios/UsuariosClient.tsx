"use client";

import { useEffect, useState } from "react";

type Usuario = {
  id: number;
  email: string;
  nome: string | null;
  ativo: boolean;
  empresa_ids: number[];
};

type Empresa = { id: number; nome: string; cnpj: string };

export default function UsuariosClient() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [form, setForm] = useState({
    email: "",
    senha: "",
    nome: "",
    empresaIdsSelecionadas: [] as number[],
  });

  async function carregar() {
    setCarregando(true);
    const [uRes, eRes] = await Promise.all([
      fetch("/api/usuarios"),
      fetch("/api/minhas-empresas"),
    ]);
    const uData = await uRes.json();
    const eData = await eRes.json();
    setUsuarios(uData.usuarios ?? []);
    setEmpresas(eData.empresas ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function toggleEmpresaSelecionada(id: number) {
    setForm((f) => ({
      ...f,
      empresaIdsSelecionadas: f.empresaIdsSelecionadas.includes(id)
        ? f.empresaIdsSelecionadas.filter((x) => x !== id)
        : [...f.empresaIdsSelecionadas, id],
    }));
  }

  async function criarUsuario() {
    setErro("");
    setSucesso("");
    if (!form.email || !form.senha) {
      setErro("Email e senha são obrigatórios.");
      return;
    }
    if (form.senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        senha: form.senha,
        nome: form.nome,
        empresa_ids: form.empresaIdsSelecionadas,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setErro(data.mensagem || "Erro ao criar usuário.");
      return;
    }
    setSucesso("Usuário criado com sucesso.");
    setForm({ email: "", senha: "", nome: "", empresaIdsSelecionadas: [] });
    carregar();
  }

  async function alternarStatus(id: number, ativoAtual: boolean) {
    await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ativo: !ativoAtual }),
    });
    carregar();
  }

  function nomesEmpresas(ids: number[]) {
    if (ids.length === 0) return "Todas (sem vínculo definido)";
    return ids
      .map((id) => empresas.find((e) => e.id === id)?.nome ?? `#${id}`)
      .join(", ");
  }

  return (
    <>
      <section className="mb-6 bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="font-semibold text-slate-700 mb-3 text-sm">Novo usuário</h2>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <input
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <input
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            placeholder="Senha (mínimo 8 caracteres)"
            type="password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
          />
        </div>

        <div className="mb-3">
          <div className="text-xs font-medium text-slate-600 mb-1">
            Empresas que este usuário pode acessar:
          </div>
          <div className="flex flex-wrap gap-2">
            {empresas.map((emp) => (
              <label
                key={emp.id}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2 py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.empresaIdsSelecionadas.includes(emp.id)}
                  onChange={() => toggleEmpresaSelecionada(emp.id)}
                />
                {emp.nome}
              </label>
            ))}
            {empresas.length === 0 && (
              <span className="text-xs text-slate-400">Nenhuma empresa cadastrada ainda.</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Se não marcar nenhuma, o usuário verá todas as empresas (comportamento provisório).
          </div>
        </div>

        {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}
        {sucesso && <div className="text-xs text-green-600 mb-2">{sucesso}</div>}

        <button
          onClick={criarUsuario}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded"
        >
          + Criar usuário
        </button>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Empresas</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{u.nome || "-"}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{nomesEmpresas(u.empresa_ids)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      u.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.ativo ? "Ativo" : "Bloqueado"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => alternarStatus(u.id, u.ativo)}
                    className={`text-xs underline ${u.ativo ? "text-red-600" : "text-green-600"}`}
                  >
                    {u.ativo ? "Bloquear" : "Desbloquear"}
                  </button>
                </td>
              </tr>
            ))}
            {!carregando && usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
