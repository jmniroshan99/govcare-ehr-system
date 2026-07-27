import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  // Fail fast and loudly instead of letting every query throw a confusing error later.
  // eslint-disable-next-line no-console
  console.error(
    "[db] DATABASE_URL is not set. Copy server/.env.example to server/.env and set a valid " +
      "postgres://user:password@host:port/database connection string.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Idle clients in the pool can still throw (e.g. the DB restarts). Without this handler
// an unhandled 'error' event on the pool would crash the whole Node process.
pool.on("error", (error) => {
  // eslint-disable-next-line no-console
  console.error("[db] Unexpected error on idle PostgreSQL client:", error.message);
});

/**
 * Runs a single parameterised query against the pool.
 * Always use parameter placeholders ($1, $2, ...) - never string-concatenate values into `text`.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[db] query ok (${Date.now() - start}ms): ${text.split("\n")[0].slice(0, 120)}`);
    }
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[db] query failed: ${text.split("\n")[0].slice(0, 120)}`, error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Runs `callback` inside a BEGIN/COMMIT transaction on a single dedicated client.
 * Rolls back automatically if `callback` throws, and always releases the client back to the pool.
 */
export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifies the pool can actually reach PostgreSQL. Call this once at server startup so a bad
 * DATABASE_URL (wrong password, wrong port, DB not running) fails immediately with a clear
 * message instead of surfacing later as a mysterious 500 on the first API request.
 */
export async function testConnection(): Promise<{ ok: true; now: Date } | { ok: false; error: string }> {
  try {
    const result = await pool.query<{ now: Date }>("select now() as now");
    return { ok: true, now: result.rows[0].now };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Closes all pool connections. Call on SIGINT/SIGTERM for a clean shutdown. */
export async function closePool() {
  await pool.end();
}
