import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { Pool } from "pg";

export type Tokens = { accessToken: string; refreshToken: string };
export type Session = {
  id_hash: string;
  generation: string;
  previous_id_hash: string | null;
  previous_generation: string | null;
  state: "anonymous" | "authenticating" | "active" | "refreshing" | "revoked";
  user_id: string | null;
  backend_session_id: string | null;
  tokens: string | null;
  access_expires_at: Date | null;
  expires_at: Date;
  operation_id: string | null;
  lease_until: Date | null;
};
export const sessionHash = (id: string) =>
  createHash("sha256").update(id).digest("hex");
export class SessionEnded extends Error {
  constructor() {
    super("SESSION_ENDED");
  }
}
export class SessionBusy extends Error {
  constructor() {
    super("SESSION_BUSY");
  }
}

export class SessionStore {
  constructor(
    readonly pool: Pool,
    private readonly key: Buffer,
  ) {
    if (key.length !== 32)
      throw new Error("Invalid BFF encryption configuration");
  }
  seal(id: string, tokens: Tokens) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokens), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64",
    );
  }
  open(row: Session): Tokens {
    if (!row.tokens) throw new SessionEnded();
    const value = Buffer.from(row.tokens, "base64"),
      decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        value.subarray(0, 12),
      );
    decipher.setAAD(Buffer.from(row.id_hash));
    decipher.setAuthTag(value.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(value.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
  }
  async create() {
    const cookie = randomBytes(32).toString("base64url"),
      id = sessionHash(cookie);
    const result = await this.pool.query<Session>(
      `INSERT INTO pawflow_bff.sessions (id_hash,generation,state,expires_at) VALUES ($1,$2,'anonymous',clock_timestamp()+interval '30 minutes') RETURNING *`,
      [id, randomUUID()],
    );
    return { cookie, row: result.rows[0] };
  }
  async read(id: string): Promise<Session | null> {
    // A claimed refresh is NEVER reclaimed: the previous worker may have consumed its token.
    await this.pool.query(
      `UPDATE pawflow_bff.sessions SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id_hash=$1 AND (expires_at<=clock_timestamp() OR (state IN ('refreshing','authenticating') AND lease_until<=clock_timestamp()))`,
      [id],
    );
    return (
      (
        await this.pool.query<Session>(
          "SELECT * FROM pawflow_bff.sessions WHERE id_hash=$1",
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async beginLogin(id: string, generation: string) {
    const operation = randomUUID();
    const result = await this.pool.query<Session>(
      `UPDATE pawflow_bff.sessions SET state='authenticating',operation_id=$3,lease_until=clock_timestamp()+interval '25 seconds',updated_at=clock_timestamp() WHERE id_hash=$1 AND generation=$2 AND state='anonymous' AND expires_at>clock_timestamp() RETURNING *`,
      [id, generation, operation],
    );
    if (!result.rows[0]) throw new SessionEnded();
    return result.rows[0];
  }
  async failLogin(row: Session) {
    await this.pool.query(
      `UPDATE pawflow_bff.sessions SET state='anonymous',operation_id=NULL,lease_until=NULL WHERE id_hash=$1 AND operation_id=$2 AND state='authenticating'`,
      [row.id_hash, row.operation_id],
    );
  }
  async activate(
    row: Session,
    tokens: Tokens,
    userId: string,
    backendId: string,
    expires: Date,
    accessExpires: Date,
  ) {
    const cookie = randomBytes(32).toString("base64url"),
      id = sessionHash(cookie);
    const result = await this.pool.query<Session>(
      `UPDATE pawflow_bff.sessions SET previous_id_hash=id_hash,previous_generation=generation,id_hash=$8,generation=$9,state='active',tokens=$3,user_id=$4,backend_session_id=$5,expires_at=$6,access_expires_at=$7,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id_hash=$1 AND operation_id=$2 AND state='authenticating' AND lease_until>clock_timestamp() RETURNING *`,
      [
        row.id_hash,
        row.operation_id,
        this.seal(id, tokens),
        userId,
        backendId,
        expires,
        accessExpires,
        id,
        randomUUID(),
      ],
    );
    if (!result.rows[0]) throw new SessionEnded();
    return { row: result.rows[0], cookie };
  }
  async end(id: string, generation: string): Promise<Session> {
    // The pre-login identity can only end its successor, never read/authenticate as it.
    const result = await this.pool.query<Session>(
      `WITH locked AS (SELECT * FROM pawflow_bff.sessions WHERE (id_hash=$1 AND generation=$2) OR (previous_id_hash=$1 AND previous_generation=$2) FOR UPDATE) UPDATE pawflow_bff.sessions s SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() FROM locked WHERE s.id_hash=locked.id_hash RETURNING locked.*`,
      [id, generation],
    );
    if (!result.rows[0]) throw new SessionEnded();
    return result.rows[0];
  }
  async revoke(id: string, generation?: string) {
    await this.pool.query(
      `UPDATE pawflow_bff.sessions SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id_hash=$1 AND ($2::uuid IS NULL OR generation=$2)`,
      [id, generation ?? null],
    );
  }
  async revokeUser(userId: string) {
    await this.pool.query(
      `UPDATE pawflow_bff.sessions SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL WHERE user_id=$1`,
      [userId],
    );
  }
  async revokeBackend(backendId: string, userId: string) {
    await this.pool.query(
      `UPDATE pawflow_bff.sessions SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL WHERE backend_session_id=$1 AND user_id=$2`,
      [backendId, userId],
    );
  }
  async assertCurrent(row: Session) {
    const current = await this.read(row.id_hash);
    if (
      !current ||
      current.generation !== row.generation ||
      !["active", "refreshing"].includes(current.state)
    )
      throw new SessionEnded();
  }
  async access(
    id: string,
    generation: string,
    rotate: (
      tokens: Tokens,
    ) => Promise<{ tokens: Tokens; expires: Date; accessExpires: Date }>,
    force = false,
  ): Promise<Session> {
    const deadline = Date.now() + 22000;
    while (Date.now() < deadline) {
      const row = await this.read(id);
      if (
        !row ||
        row.generation !== generation ||
        !["active", "refreshing"].includes(row.state)
      )
        throw new SessionEnded();
      if (
        row.state === "active" &&
        !force &&
        row.access_expires_at &&
        row.access_expires_at.getTime() > Date.now() + 15000
      )
        return row;
      if (row.state === "active") {
        const operation = randomUUID();
        const claim = await this.pool.query<Session>(
          `UPDATE pawflow_bff.sessions SET state='refreshing',operation_id=$3,lease_until=clock_timestamp()+interval '20 seconds' WHERE id_hash=$1 AND generation=$2 AND state='active' AND tokens=$4 RETURNING *`,
          [id, generation, operation, row.tokens],
        );
        if (claim.rows[0]) {
          try {
            const next = await rotate(this.open(row));
            const saved = await this.pool.query<Session>(
              `UPDATE pawflow_bff.sessions SET state='active',tokens=$4,expires_at=LEAST(expires_at,$5),access_expires_at=$6,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id_hash=$1 AND generation=$2 AND operation_id=$3 AND state='refreshing' AND lease_until>clock_timestamp() AND expires_at>clock_timestamp() RETURNING *`,
              [
                id,
                generation,
                operation,
                this.seal(id, next.tokens),
                next.expires,
                next.accessExpires,
              ],
            );
            if (!saved.rows[0]) throw new SessionEnded();
            return saved.rows[0];
          } catch {
            // Includes timeout, disconnect, invalid response and unknown commit result. Never resend.
            await this.revoke(id, generation);
            throw new SessionEnded();
          }
        }
      }
      force = false;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    throw new SessionBusy();
  }
  async cleanup() {
    await this.pool.query(
      `UPDATE pawflow_bff.sessions SET state='revoked',tokens=NULL,operation_id=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE state IN ('authenticating','refreshing') AND lease_until<=clock_timestamp()`,
    );
    await this.pool.query(
      `DELETE FROM pawflow_bff.sessions WHERE expires_at<clock_timestamp() OR (state='revoked' AND updated_at<clock_timestamp()-interval '1 day')`,
    );
  }
}
let instance: SessionStore | undefined;
export function sessionStore() {
  if (!instance) {
    const url = process.env.BFF_DATABASE_URL,
      key = process.env.BFF_TOKEN_ENCRYPTION_KEY;
    if (!url || !key || !/^[A-Za-z0-9+/]{43}=$/.test(key))
      throw new Error("Missing BFF configuration");
    const pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
    });
    pool.on("error", () => {
      /* No connection strings or SQL parameters in logs. Requests fail closed. */
    });
    instance = new SessionStore(pool, Buffer.from(key, "base64"));
  }
  return instance;
}
