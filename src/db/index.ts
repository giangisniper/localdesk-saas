import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString: url, max: 10 });
}

export const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
