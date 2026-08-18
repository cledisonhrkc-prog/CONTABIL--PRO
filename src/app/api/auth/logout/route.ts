import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, mensagem: "Sessão encerrada." });
  // Limpa a sessão de login...
  res.cookies.set("sessao", "", { path: "/", maxAge: 0 });
  // ...e a empresa ativa selecionada. Sem isso, o cookie "empresa_ativa_id"
  // sobrevive ao logout e pode ser reaproveitado silenciosamente na próxima
  // sessão (mesmo usuário esquecido, ou outro usuário no mesmo navegador),
  // contornando a exigência de seleção explícita do módulo financeiro.
  res.cookies.set("empresa_ativa_id", "", { path: "/", maxAge: 0 });
  return res;
}
