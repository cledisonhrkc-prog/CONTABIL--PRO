import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, mensagem: "Sessão encerrada." });
  res.cookies.set("sessao", "", { path: "/", maxAge: 0 });
  return res;
}
