import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Match the Figma sandbox, which does not provide this browser API.
globalThis.structuredClone = undefined;
for (const entry of ["src/engine.test-runner.ts", "src/plugin.test-runner.ts", "src/catalog.test-runner.ts", "src/reference.test-runner.ts", "src/motion-system.test-runner.ts", "src/control-effects.test-runner.ts"]) {
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "node18",
  });

  const source = result.outputFiles[0].text;
  try {
    await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  } catch (error) {
    console.error(`${entry}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    break;
  }
}
