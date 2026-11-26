import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(join(tmpdir(), "pawflow-provider-tests-"));
const tests = [
  "features/provider-workspace/liveApi",
  "features/provider-workspace/lifecycle",
  "features/provider-profile/profileLogic",
  "features/provider-availability/availabilityLogic",
  "features/provider-bookings/bookingLogic",
  "features/provider-customers/customerLogic",
  "features/provider-dashboard/data/dashboardAnalytics",
  "features/provider-notifications/notificationLogic",
  "features/provider-services/serviceLogic",
  "lib/locale",
];

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, NODE_PATH: join(root, "node_modules") },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Provider validation failed");
  }
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
    ...tests.map((file) => `src/${file}.test.ts`),
  ]);
  run([
    "--test",
    ...tests.map((file) => join(output, "src", `${file}.test.js`)),
  ]);
} catch {
  process.exitCode = 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
