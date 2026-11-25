// Requires an explicitly isolated PostgreSQL QA database; never creates/drops a database.
import { Pool } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const url = process.env.BFF_DATABASE_URL;
if (
  !url ||
  !/^pawflow_bff_qa(?:_|$)/.test(new URL(url).pathname.slice(1)) ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("Use an isolated local pawflow_bff_qa database");
const modulePath = path.resolve(
  process.env.BFF_TEST_BUILD ||
    "/tmp/pawflow-bff-tests/lib/server/bff/store.js",
);
const { SessionStore, SessionEnded } = await import(modulePath);
const key = randomBytes(32),
  pool = new Pool({ connectionString: url }),
  store = new SessionStore(pool, key);
let calls = 0,
  mode = "ok",
  delay = 250;
const server = http.createServer(async (req, res) => {
  calls++;
  await new Promise((r) => setTimeout(r, delay));
  if (mode === "disconnect") {
    res.destroy();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      tokens: {
        accessToken: "access-new",
        refreshToken: randomBytes(32).toString("base64url"),
      },
      expires: new Date(Date.now() + 60000),
      accessExpires: new Date(Date.now() + 50000),
    }),
  );
});
const worker = `const {Pool}=require('pg');const {SessionStore}=require(process.env.STORE_MODULE);const pool=new Pool({connectionString:process.env.BFF_DATABASE_URL});const store=new SessionStore(pool,Buffer.from(process.env.QA_KEY,'base64'));process.on('message',async input=>{try{await store.access(input.id,input.generation,async()=>{const response=await fetch(process.env.QA_REFRESH_URL);const result=await response.json();return {...result,expires:new Date(result.expires),accessExpires:new Date(result.accessExpires)};});process.send({ok:true,pid:process.pid});}catch{process.send({ok:false,pid:process.pid});}finally{await pool.end();process.exit();}});`;
function child(row) {
  const p = spawn(process.execPath, ["-e", worker], {
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    env: {
      ...process.env,
      NODE_PATH: path.resolve("node_modules"),
      STORE_MODULE: modulePath,
      QA_KEY: key.toString("base64"),
      QA_REFRESH_URL: `http://127.0.0.1:${server.address().port}/refresh`,
    },
  });
  let stderr = "";
  p.stderr.on("data", (d) => (stderr += d));
  const result = new Promise((resolve, reject) => {
    p.once("message", resolve);
    p.once("error", reject);
    p.once("exit", (code) => {
      if (code) reject(new Error("Worker failed (details omitted)"));
    });
  });
  p.send({ id: row.id_hash, generation: row.generation });
  return { p, result };
}
async function seed() {
  const { row } = await store.create();
  const claim = await store.beginLogin(row.id_hash, row.generation);
  return (await store.activate(
    claim,
    {
      accessToken: "access-secret",
      refreshToken: randomBytes(32).toString("base64url"),
    },
    "1",
    randomUUID(),
    new Date(Date.now() + 60000),
    new Date(Date.now() - 1000),
  )).row;
}
async function waitCalls(target) {
  const until = Date.now() + 5000;
  while (calls < target && Date.now() < until)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls, target);
}
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    await pool.query(fs.readFileSync("database/bff/001_sessions.sql", "utf8"));
    await pool.query(fs.readFileSync("database/bff/002_login_rotation.sql", "utf8"));
    let row = await seed();
    const raw = await store.read(row.id_hash);
    assert(!raw.tokens.includes("access-secret"));
    assert.equal(store.open(raw).accessToken, "access-secret");
    assert.throws(() => new SessionStore(pool, randomBytes(32)).open(raw));
    assert.throws(() => store.open({ ...raw, id_hash: "0".repeat(64) }));
    const damaged = Buffer.from(raw.tokens, "base64");
    damaged[damaged.length - 1] ^= 1;
    assert.throws(() => store.open({ ...raw, tokens: damaged.toString("base64") }));
    console.log("PASS encrypted tokens at rest; wrong key, row substitution and tampering rejected");
    let a = child(row),
      b = child(row);
    let results = await Promise.all([a.result, b.result]);
    assert(results.every((r) => r.ok));
    assert.notEqual(results[0].pid, results[1].pid);
    assert.equal(calls, 1);
    console.log("PASS two OS processes: exactly one rotation");
    row = await seed();
    delay = 600;
    const before = calls;
    a = child(row);
    await waitCalls(before + 1);
    await store.revoke(row.id_hash, row.generation);
    assert.equal((await a.result).ok, false);
    assert.equal((await store.read(row.id_hash)).tokens, null);
    console.log("PASS logout wins over late refresh");
    row = await seed();
    mode = "disconnect";
    a = child(row);
    assert.equal((await a.result).ok, false);
    const consumed = calls;
    b = child(row);
    assert.equal((await b.result).ok, false);
    assert.equal(calls, consumed);
    console.log("PASS uncertain refresh fails closed without replay");
    mode = "ok";
    row = await seed();
    delay = 1200;
    const start = calls;
    a = child(row);
    await waitCalls(start + 1);
    a.p.kill("SIGKILL");
    a.result.catch(() => {});
    await pool.query(
      "UPDATE pawflow_bff.sessions SET lease_until=clock_timestamp()-interval '1 second' WHERE id_hash=$1",
      [row.id_hash],
    );
    b = child(row);
    assert.equal((await b.result).ok, false);
    assert.equal(calls, start + 1);
    console.log("PASS process death and expired lease never reclaim token");
    row = await seed();
    await pool.query(
      "UPDATE pawflow_bff.sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id_hash=$1",
      [row.id_hash],
    );
    a = child(row);
    assert.equal((await a.result).ok, false);
    console.log("PASS expired session denied");
    row = await seed();
    await assert.rejects(
      store.access(row.id_hash, randomUUID(), async () => {
        throw new Error("must not rotate");
      }),
      SessionEnded,
    );
    console.log("PASS stale account generation denied");
    const { row: pending } = await store.create();
    const claim = await store.beginLogin(pending.id_hash, pending.generation);
    await store.revoke(pending.id_hash, pending.generation);
    await assert.rejects(
      store.activate(
        claim,
        { accessToken: "late", refreshToken: "late" },
        "2",
        randomUUID(),
        new Date(Date.now() + 10000),
        new Date(Date.now() + 10000),
      ),
      SessionEnded,
    );
    console.log("PASS late login cannot revive logged-out session");
    const endable = await seed();
    const ended = await store.end(endable.id_hash, endable.generation);
    assert.equal(ended.state, "active");
    assert.equal(store.open(ended).accessToken, "access-secret");
    assert.equal((await store.read(endable.id_hash)).tokens, null);
    await assert.rejects(
      store.access(endable.id_hash, endable.generation, async () => {
        throw Error("must not refresh");
      }),
      SessionEnded,
    );
    console.log(
      "PASS atomic logout captures token owner and permanently fences refresh",
    );
    await store.revokeUser("1");
    await assert.rejects(store.assertCurrent(row), SessionEnded);
    console.log("PASS logout-all fences all BFF sessions");
    const abandoned = await seed();
    await pool.query(
      "UPDATE pawflow_bff.sessions SET state='refreshing',lease_until=clock_timestamp()-interval '1 second' WHERE id_hash=$1",
      [abandoned.id_hash],
    );
    await store.cleanup();
    assert.equal((await store.read(abandoned.id_hash)).tokens, null);
    console.log("PASS expiry cleanup");
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await pool.end();
  }
})().catch(() => {
  console.error(
    "FAIL shared-store QA (details omitted to avoid credential leakage)",
  );
  process.exitCode = 1;
});
