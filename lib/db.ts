import { Pool, type PoolConfig } from "pg";

declare global {
  var __autopulsePool: Pool | undefined;
}

function hydratePassword(connectionString: string, password?: string) {
  if (!password) {
    return connectionString;
  }

  return connectionString.replace("[SUPABASE_DB_PASSWORD]", password);
}

function getConnectionString() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const sessionPoolerUrl =
    process.env.SUPABASE_SESSION_POOLER ?? process.env.SUPABAE_SESSION_POOLER;
  const directUrl = process.env.SUPABASE_DIRECT_CONNECT_URL;

  if (sessionPoolerUrl) {
    return hydratePassword(sessionPoolerUrl, password);
  }

  if (directUrl) {
    return hydratePassword(directUrl, password);
  }

  const user = process.env.SUPABASE_DB_USER;
  const host = process.env.SUPABASE_DB_HOST;
  const port = process.env.SUPABASE_DB_PORT ?? "5432";
  const database = process.env.SUPABASE_DB_NAME ?? "postgres";

  if (!user || !password || !host) {
    return null;
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
}

export function isDatabaseConfigured() {
  return Boolean(getConnectionString());
}

export function getPool() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("Supabase database credentials are not configured.");
  }

  if (!global.__autopulsePool) {
    const config: PoolConfig = {
      connectionString,
      max: 5,
      keepAlive: true,
      ssl: { rejectUnauthorized: false }
    };

    global.__autopulsePool = new Pool(config);
  }

  return global.__autopulsePool;
}
