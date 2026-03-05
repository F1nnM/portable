import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/setup.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
});
