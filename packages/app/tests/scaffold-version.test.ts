import { describe, expect, it } from "vitest";
import { generatePortableYaml, parsePortableYaml } from "~/server/utils/scaffold-version";

describe("generatePortableYaml", () => {
  it("generates valid YAML with scaffold metadata", () => {
    const result = generatePortableYaml({
      repoUrl: "https://github.com/user/portable",
      scaffoldPath: "scaffolds/nuxt-postgres",
      version: "abc123",
    });

    expect(result).toContain("repo: https://github.com/user/portable");
    expect(result).toContain("path: scaffolds/nuxt-postgres");
    expect(result).toContain("version: abc123");
  });
});

describe("parsePortableYaml", () => {
  it("parses valid .portable.yaml content", () => {
    const yaml = `scaffold:\n  repo: https://github.com/user/portable\n  path: scaffolds/nuxt-postgres\n  version: abc123\n`;
    const result = parsePortableYaml(yaml);
    expect(result).toEqual({
      repo: "https://github.com/user/portable",
      path: "scaffolds/nuxt-postgres",
      version: "abc123",
    });
  });

  it("returns null for invalid YAML", () => {
    expect(parsePortableYaml("not yaml at all {{{")).toBeNull();
  });

  it("returns null for YAML missing scaffold key", () => {
    expect(parsePortableYaml("other: data\n")).toBeNull();
  });

  it("roundtrips with generatePortableYaml", () => {
    const config = {
      repoUrl: "https://github.com/user/portable",
      scaffoldPath: "scaffolds/nuxt-postgres",
      version: "abc123def456",
    };
    const yaml = generatePortableYaml(config);
    const parsed = parsePortableYaml(yaml);
    expect(parsed).toEqual({
      repo: config.repoUrl,
      path: config.scaffoldPath,
      version: config.version,
    });
  });
});
