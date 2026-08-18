import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-financeiro";
import { db } from "@/db";
import { categoriasFinanceiras } from "@/db/schema-financeiro";
import { eq, and, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  return withAuth(async (ctx) => {
    const tipo = req.nextUrl.searchParams.get("tipo");
    const conditions = [eq(categoriasFinanceiras.empresaId, ctx.empresaId)];
    if (tipo) conditions.push(eq(categoriasFinanceiras.tipo, tipo));
    return db.select().from(categoriasFinanceiras).where(and(...conditions)).orderBy(asc(categoriasFinanceiras.nome));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async (ctx) => {
    const body = await req.json();
    if (!body.nome || !body.tipo) throw new Error("nome e tipo são obrigatórios");
    const [cat] = await db.insert(categoriasFinanceiras).values({
      empresaId: ctx.empresaId,
      nome: body.nome,
      tipo: body.tipo,
      cor: body.cor || "#6B7280",
      icone: body.icone || null,
      ativo: true,
    }).returning();
    return cat;
  });
}
