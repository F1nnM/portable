import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const scaffoldDir = resolve(__dirname, "../../../../scaffolds/nuxt-postgres");

describe("nuxt-postgres scaffold", () => {
  it("scaffold directory exists", () => {
    expect(existsSync(scaffoldDir)).toBe(true);
  });

  it("package.json exists and is valid JSON", () => {
    const pkgPath = resolve(scaffoldDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    expect(pkg).toBeDefined();
    expect(pkg.name).toBe("project-template");
  });

  it("package.json has required dependencies", () => {
    const pkg = JSON.parse(readFileSync(resolve(scaffoldDir, "package.json"), "utf-8"));
    expect(pkg.dependencies).toHaveProperty("nuxt");
    expect(pkg.dependencies).toHaveProperty("drizzle-orm");
    expect(pkg.dependencies).toHaveProperty("postgres");
  });

  it("package.json has required dev dependencies", () => {
    const pkg = JSON.parse(readFileSync(resolve(scaffoldDir, "package.json"), "utf-8"));
    expect(pkg.devDependencies).toHaveProperty("drizzle-kit");
    expect(pkg.devDependencies).toHaveProperty("typescript");
  });

  it("package.json has required scripts", () => {
    const pkg = JSON.parse(readFileSync(resolve(scaffoldDir, "package.json"), "utf-8"));
    expect(pkg.scripts).toHaveProperty("dev");
    expect(pkg.scripts).toHaveProperty("build");
    expect(pkg.scripts).toHaveProperty("db:generate");
    expect(pkg.scripts).toHaveProperty("db:push");
    expect(pkg.scripts).toHaveProperty("postinstall");
  });

  it("CLAUDE.md exists and contains dev server instructions", () => {
    const claudePath = resolve(scaffoldDir, "CLAUDE.md");
    expect(existsSync(claudePath)).toBe(true);
    const content = readFileSync(claudePath, "utf-8");
    expect(content.toLowerCase()).toContain("dev server");
  });

  it("CLAUDE.md contains DATABASE_URL reference", () => {
    const content = readFileSync(resolve(scaffoldDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("DATABASE_URL");
  });

  it("nuxt.config.ts exists", () => {
    expect(existsSync(resolve(scaffoldDir, "nuxt.config.ts"))).toBe(true);
  });

  it("tsconfig.json exists", () => {
    expect(existsSync(resolve(scaffoldDir, "tsconfig.json"))).toBe(true);
  });

  it("server/db/schema.ts exists", () => {
    expect(existsSync(resolve(scaffoldDir, "server/db/schema.ts"))).toBe(true);
  });

  it("server/utils/db.ts exists", () => {
    expect(existsSync(resolve(scaffoldDir, "server/utils/db.ts"))).toBe(true);
  });

  it("all required API route files exist", () => {
    const apiRoutes = [
      "server/api/todos.get.ts",
      "server/api/todos.post.ts",
      "server/api/todos/[id].patch.ts",
      "server/api/todos/[id].delete.ts",
    ];
    for (const route of apiRoutes) {
      expect(existsSync(resolve(scaffoldDir, route)), `missing: ${route}`).toBe(true);
    }
  });

  it("pages/index.vue exists", () => {
    expect(existsSync(resolve(scaffoldDir, "pages/index.vue"))).toBe(true);
  });

  it("app.vue exists", () => {
    expect(existsSync(resolve(scaffoldDir, "app.vue"))).toBe(true);
  });

  it(".gitignore exists", () => {
    expect(existsSync(resolve(scaffoldDir, ".gitignore"))).toBe(true);
  });

  it("drizzle.config.ts exists", () => {
    expect(existsSync(resolve(scaffoldDir, "drizzle.config.ts"))).toBe(true);
  });

  it(".env.example exists with DATABASE_URL placeholder", () => {
    const envPath = resolve(scaffoldDir, ".env.example");
    expect(existsSync(envPath)).toBe(true);
    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("DATABASE_URL");
  });

  it("server/db/schema.ts defines a todos table", () => {
    const content = readFileSync(resolve(scaffoldDir, "server/db/schema.ts"), "utf-8");
    expect(content).toContain("todos");
    expect(content).toContain("title");
    expect(content).toContain("completed");
  });

  it("server/utils/db.ts reads DATABASE_URL from env", () => {
    const content = readFileSync(resolve(scaffoldDir, "server/utils/db.ts"), "utf-8");
    expect(content).toContain("DATABASE_URL");
  });
});
