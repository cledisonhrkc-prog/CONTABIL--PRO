import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Supabase / provedores gerenciados exigem SSL.
// Local (postgres:postgres@127.0.0.1) não usa.
const needsSsl =
  databaseUrl.includes("supabase.co") ||
  databaseUrl.includes("supabase.com") ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("render.com") ||
  databaseUrl.includes("aws") ||
  databaseUrl.includes("azure") ||
  databaseUrl.includes("sslmode=require");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
