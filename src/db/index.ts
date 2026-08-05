import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// -----------------------------------------------------------------------------
// Conexão LAZY: nada é aberto/verificado em tempo de build.
// A Pool e o cliente Drizzle só são criados na 1ª chamada real ao banco.
// Isso permite `next build` no Vercel sem DATABASE_URL definido.
// -----------------------------------------------------------------------------

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: NodePgDatabase;
};

function detectSsl(url: string): boolean {
  return (
    url.includes("supabase.co") ||
    url.includes("supabase.com") ||
    url.includes("neon.tech") ||
    url.includes("render.com") ||
    url.includes("amazonaws") ||
    url.includes("azure") ||
    url.includes("sslmode=require")
  );
}

function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) return globalForDb.__arenaNextJsPostgresqlPool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required at runtime. Configure no painel do Vercel (Project Settings > Environment Variables)."
    );
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: detectSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  } else {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
  return pool;
}

function getDb(): NodePgDatabase {
  if (globalForDb.__arenaNextJsDrizzle) return globalForDb.__arenaNextJsDrizzle;
  const instance = drizzle(getPool());
  globalForDb.__arenaNextJsDrizzle = instance;
  return instance;
}

// Proxy: qualquer acesso a `db.<algo>` chama getDb() na hora do uso, não no import.
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(real);
    }
    return value;
  },
}) as NodePgDatabase;

// Mantido para compatibilidade (getter lazy)
export function pool(): Pool {
  return getPool();
}
