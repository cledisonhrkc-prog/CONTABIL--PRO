import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Lê DATABASE_URL do .env — funciona tanto local quanto Supabase
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
    ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : false,
  },
} satisfies Config;
