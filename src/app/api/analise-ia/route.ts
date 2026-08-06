import { NextResponse } from "next/server";
import { gerarDossieIA, formatarDossieTexto } from "@/lib/analise-ia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") ?? "json"; // json | texto | download
  const dossie = await gerarDossieIA();
  if (!dossie)
    return NextResponse.json({ ok: false, error: "Sem empresa cadastrada" }, { status: 404 });

  if (formato === "texto" || formato === "download") {
    const txt = formatarDossieTexto(dossie);
    if (formato === "download") {
      return new NextResponse(txt, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="dossie_ia_${Date.now()}.md"`,
        },
      });
    }
    return new NextResponse(txt, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json({ ok: true, dossie });
}
