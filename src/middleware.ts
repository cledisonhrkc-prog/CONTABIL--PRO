import { NextRequest, NextResponse } from "next/server";
import { verificarTokenSessao } from "@/lib/auth";

// Roda em runtime Node (não Edge) para poder usar módulos nativos com segurança.
export const runtime = "nodejs";

const ROTAS_PUBLICAS = ["/login", "/api/auth/login", "/api/auth/criar-usuario", "/api/health"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publica = ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const estatico =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|svg|ico|css|js|woff|woff2)$/.test(pathname);

  if (publica || estatico) {
    return NextResponse.next();
  }

  const token = req.cookies.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);

  if (!sessao) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
