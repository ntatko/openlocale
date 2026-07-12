import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // bundle workspace packages so the published binary is self-contained
  noExternal: [/^@openlocale\//],
  banner: {
    // CJS deps (yaml, papaparse, …) get bundled into this ESM output;
    // give them a working require()
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
  }
});
