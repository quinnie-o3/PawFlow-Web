import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(join(tmpdir(), "pawflow-account-tests-"));
const tests = [
  "lib/api/foundation",
  "features/auth/services/authApi",
  "features/auth/turnstile/turnstile",
  "features/auth/recovery/recovery",
  "features/customer-account/profileLogic",
  "features/customer-account/api",
  "features/customer-pets/petLogic",
  "features/customer-pets/petImages",
  "features/session/client",
  "features/customer-booking/mockWorkspace",
];
const env = {
  ...process.env,
  NODE_PATH: join(root, "node_modules"),
  BFF_TEST_BUILD: join(output, "src/lib/server/bff/store.js"),
  BFF_HTTP_BUILD: join(output, "src"),
};
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Account/session validation failed");
}
try {
  run([
    "node_modules/typescript/bin/tsc",
    "--strict",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "ES2022",
    "--esModuleInterop",
    "--resolveJsonModule",
    "--skipLibCheck",
    "--outDir",
    output,
    ...tests.map((file) => "src/" + file + ".test.ts"),
  ]);
  run([
    "--test",
    ...tests.map((file) => join(output, "src", file + ".test.js")),
  ]);
  if (process.argv.includes("--shared-store")) {
    run(["scripts/test-bff-store.mjs"]);
    run(["scripts/test-bff-http.mjs"]);
  }
} catch {
  process.exitCode = 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
