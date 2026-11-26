import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(join(tmpdir(), "pawflow-provider-tests-"));
const tests = [
  "features/provider-workspace/liveApi.test.ts",
  "features/provider-workspace/lifecycle.test.ts",
  "features/provider-profile/profileLogic.test.ts",
  "features/provider-availability/availabilityLogic.test.ts",
  "features/provider-bookings/bookingLogic.test.ts",
  "features/provider-bookings/components/BookingDetailsDialog.test.tsx",
  "features/provider-customers/customerLogic.test.ts",
  "features/provider-dashboard/data/dashboardAnalytics.test.ts",
  "features/provider-notifications/notificationLogic.test.ts",
  "features/provider-services/serviceLogic.test.ts",
  "lib/locale.test.ts",
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
  const cssTypesPath = join(output, "css-modules.d.ts");
  writeFileSync(
    cssTypesPath,
    'declare module "*.module.css" {\n  const styles: Record<string, string>;\n  export default styles;\n}\n',
  );

  const tsconfigPath = join(output, "tsconfig.provider-test.json");
  writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          module: "commonjs",
          moduleResolution: "node",
          target: "ES2022",
          jsx: "react-jsx",
          esModuleInterop: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          baseUrl: root,
          rootDir: root,
          outDir: output,
          paths: {
            "@/*": ["./src/*"],
          },
        },
        files: [
          cssTypesPath,
          ...tests.map((file) => join(root, "src", file)),
        ],
      },
      null,
      2,
    ),
  );

  const preloadPath = join(output, "test-preload.cjs");
  writeFileSync(
    preloadPath,
    [
      'const Module = require("node:module");',
      'const path = require("node:path");',
      `const outSrc = ${JSON.stringify(join(output, "src"))};`,
      'const origResolve = Module._resolveFilename;',
      "Module._resolveFilename = function (request, parent, isMain, options) {",
      '  if (typeof request === "string" && request.startsWith("@/")) {',
      "    return origResolve.call(this, path.join(outSrc, request.slice(2)), parent, isMain, options);",
      "  }",
      '  if (typeof request === "string" && request.endsWith(".css")) {',
      '    return path.resolve(parent ? path.dirname(parent.filename) : outSrc, request);',
      "  }",
      "  return origResolve.call(this, request, parent, isMain, options);",
      "};",
      'Module._extensions[".css"] = function (mod) {',
      '  const proxy = new Proxy({}, { get: (_target, prop) => (typeof prop === "string" ? prop : "") });',
      '  mod.exports = { __esModule: true, default: proxy };',
      "};",
      "",
    ].join("\n"),
  );

  run(["node_modules/typescript/bin/tsc", "-p", tsconfigPath]);
  run([
    "--require",
    preloadPath,
    "--test",
    ...tests.map((file) =>
      join(output, "src", file.replace(/\.tsx?$/, ".js")),
    ),
  ]);
} catch {
  process.exitCode = 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
