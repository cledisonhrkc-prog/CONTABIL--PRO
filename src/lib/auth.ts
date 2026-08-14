import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// ============================================================
// ATENÇÃO: defina a variável de ambiente AUTH_SECRET na Vercel
// (Settings → Environment Variables) ANTES de usar isso com
// dados reais de cliente. Sem isso, o sistema funciona mas usa
// um segredo padrão embutido no código, o que é inseguro para
// produção de verdade.
// ============================================================
const SECRET = process.env.AUTH_SECRET || "contabil-pro-fallback-secret-TROCAR-EM-PRODUCAO";
const SESSAO_DURACAO_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

export async function ensureUsuariosTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email VARCHAR(150) NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      nome TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Garante a coluna "admin" mesmo em bancos que já tinham a tabela
  // criada antes dela existir (ambiente já estava em produção).
  await db.execute(sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT false
  `);
}

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const [salt, hash] = hashArmazenado.split(":");
  if (!salt || !hash) return false;
  const hashTentativa = scryptSync(senha, salt, 64).toString("hex");
  const bufA = Buffer.from(hash, "hex");
  const bufB = Buffer.from(hashTentativa, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function criarTokenSessao(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSAO_DURACAO_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const assinatura = createHmac("sha256", SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${assinatura}`;
}

export function verificarTokenSessao(token: string | undefined | null): { email: string } | null {
  if (!token) return null;
  const [payloadB64, assinatura] = token.split(".");
  if (!payloadB64 || !assinatura) return null;

  const assinaturaEsperada = createHmac("sha256", SECRET).update(payloadB64).digest("hex");
  if (assinatura !== assinaturaEsperada) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Retorna true se o email pertence a um usuário admin ativo.
 * Usado para proteger rotas administrativas (ex: gerenciar usuários).
 */
export async function ehAdmin(email: string): Promise<boolean> {
  await ensureUsuariosTable();
  const r = await db.execute<{ admin: boolean; ativo: boolean }>(sql`
    SELECT admin, ativo FROM usuarios WHERE email = ${email}
  `);
  const u = r.rows[0];
  return !!u && u.ativo && u.admin;
}
