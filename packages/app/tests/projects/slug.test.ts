import { describe, expect, it } from "vitest";
import { generateSlug } from "../../server/utils/slug";

describe("generateSlug", () => {
  it("converts to lowercase", () => {
    expect(generateSlug("My Project")).toBe("my-project");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("hello world test")).toBe("hello-world-test");
  });

  it("removes special characters", () => {
    expect(generateSlug("project@#$%name!")).toBe("projectname");
  });

  it("removes consecutive hyphens", () => {
    expect(generateSlug("hello---world")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("--hello-world--")).toBe("hello-world");
  });

  it("truncates to 50 characters", () => {
    const longName = "a".repeat(60);
    const slug = generateSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it("handles mixed special characters and spaces", () => {
    expect(generateSlug("My Cool Project! (v2)")).toBe("my-cool-project-v2");
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });

  it("handles string that becomes empty after cleaning", () => {
    expect(generateSlug("@#$%")).toBe("");
  });

  it("preserves numbers", () => {
    expect(generateSlug("project 123")).toBe("project-123");
  });

  it("replaces underscores with hyphens", () => {
    expect(generateSlug("my_cool_project")).toBe("my-cool-project");
  });

  it("does not leave trailing hyphen after truncation", () => {
    // 50 chars ending with a hyphen should be trimmed
    const name = "a".repeat(49) + " b".repeat(10);
    const slug = generateSlug(name);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug).not.toMatch(/^-|-$/);
  });
});
