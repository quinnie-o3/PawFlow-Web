import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), output = mkdtempSync(join(tmpdir(), "pawflow-search-tests-"));
const tests = ["features/public-catalog/catalog", "features/customer-discovery/searchLogic", "features/customer-catalog/mockRepository", "features/notifications/notifications", "features/customer-booking/mockWorkspace", "features/session/client"];
function run(args) { const r = spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, NODE_PATH: join(root, "node_modules") }, stdio: "inherit" }); if (r.status !== 0) throw Error("Search validation failed"); }
try {
  run(["node_modules/typescript/bin/tsc", "--strict", "--module", "commonjs", "--moduleResolution", "node", "--target", "ES2022", "--esModuleInterop", "--resolveJsonModule", "--skipLibCheck", "--outDir", output, ...tests.map(f => "src/" + f + ".test.ts")]);
  run(["--test", ...tests.map(f => join(output, "src", f + ".test.js"))]);
} catch { process.exitCode = 1; } finally { rmSync(output, { recursive: true, force: true }); }
