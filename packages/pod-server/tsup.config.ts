import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  noExternal: [/.*/],
  external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
});
