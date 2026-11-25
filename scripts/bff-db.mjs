import { Pool } from "pg";
import { readFile } from "node:fs/promises";
const action = process.argv[2];
if (!["migrate", "check", "cleanup"].includes(action) || !process.env.BFF_DATABASE_URL)
  throw new Error("Use migrate, check or cleanup with BFF_DATABASE_URL");
const pool = new Pool({ connectionString: process.env.BFF_DATABASE_URL, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 10000 });
try {
  if (action === "migrate") {
    if (process.env.BFF_MIGRATION_REVIEWED !== "yes")
      throw new Error(
        "Review database/bff migrations and target database, then set BFF_MIGRATION_REVIEWED=yes",
      );
    for (const name of ["001_sessions.sql", "002_login_rotation.sql"])
      await pool.query(await readFile(new URL("../database/bff/" + name, import.meta.url), "utf8"));
  }
  await pool.query(await readFile(new URL("../database/bff/check.sql", import.meta.url), "utf8"));
  if (action === "cleanup") {
    await pool.query(
      "UPDATE pawflow_bff.sessions SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE state IN ('authenticating','refreshing') AND lease_until<=clock_timestamp()",
    );
    await pool.query(
      "DELETE FROM pawflow_bff.sessions WHERE expires_at<clock_timestamp() OR (state='revoked' AND updated_at<clock_timestamp()-interval '1 day')",
    );
  }
  console.log("BFF database operation completed");
} catch {
  console.error(
    "BFF database operation failed; configuration and SQL parameters are omitted",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
