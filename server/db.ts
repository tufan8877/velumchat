// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pkg;

// ===============================
// ENV CHECK
// ===============================
if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is not set (Render → Environment)");
}

// ===============================
// POSTGRES POOL (Render-kompatibel)
// ===============================
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // WICHTIG für Render
  },
});

// ===============================
// DRIZZLE INSTANCE
// ===============================
export const db = drizzle(pool, { schema });
