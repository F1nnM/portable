import { describe, expect, it } from "vitest";
import { parseCookie, parseSubdomain } from "../../server/utils/proxy-shared";

describe("parseSubdomain edge cases", () => {
  const domain = "portable.example.com";

  it("handles preview slug with numbers", () => {
    const result = parseSubdomain("project-123--preview--portable.example.com", domain);
    expect(result).toEqual({ slug: "project-123", type: "preview" });
  });

  it("handles preview slug that is just a number", () => {
    const result = parseSubdomain("42--preview--portable.example.com", domain);
    expect(result).toEqual({ slug: "42", type: "preview" });
  });

  it("handles single-char preview slug", () => {
    const result = parseSubdomain("a--preview--portable.example.com", domain);
    expect(result).toEqual({ slug: "a", type: "preview" });
  });

  it("returns null for non-preview subdomain with numbers", () => {
    const result = parseSubdomain("project-123--portable.example.com", domain);
    expect(result).toBeNull();
  });

  it("returns null for non-preview subdomain that is just a number", () => {
    const result = parseSubdomain("42--portable.example.com", domain);
    expect(result).toBeNull();
  });

  it("returns null for single-char non-preview subdomain", () => {
    const result = parseSubdomain("a--portable.example.com", domain);
    expect(result).toBeNull();
  });
});

describe("parseCookie edge cases", () => {
  it("handles cookie value with equals sign", () => {
    // Base64 values can contain =
    const result = parseCookie("token=abc123==; other=val", "token");
    expect(result).toBe("abc123==");
  });

  it("handles cookie name that is prefix of another", () => {
    const result = parseCookie(
      "portable_session_extra=wrong; portable_session=right",
      "portable_session",
    );
    expect(result).toBe("right");
  });

  it("returns null when cookie header has leading spaces before name", () => {
    // The regex expects cookie names immediately after start-of-string or "; "
    // Leading spaces before the cookie name do not match
    const result = parseCookie("  portable_session = abc123 ; other=val", "portable_session");
    expect(result).toBeNull();
  });
});
