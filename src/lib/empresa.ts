import { db } from "@/db";
import { empresas } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getEmpresaAtiva() {
  const rows = await db.select().from(empresas).limit(1);
  return rows[0] ?? null;
}

export async function garantirEmpresa(dados: {
  cnpj: string;
  nome: string;
  regime?: string;
  anexo_simples?: string;
  segmento?: string;
}) {
  const existente = await db
    .select()
    .from(empresas)
    .where(eq(empresas.cnpj, dados.cnpj.replace(/\D/g, "")))
    .limit(1);
  if (existente[0]) return existente[0];
  const [novo] = await db
    .insert(empresas)
    .values({
      cnpj: dados.cnpj.replace(/\D/g, ""),
      nome: dados.nome,
      regime: dados.regime ?? "SIMPLES",
      anexo_simples: dados.anexo_simples ?? "I",
      segmento: dados.segmento ?? "COMERCIO",
    })
    .returning();
  return novo;
}
