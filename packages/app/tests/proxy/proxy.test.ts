import { describe, expect, it } from "vitest";
import { buildProxyTarget, getDomainFromBaseUrl, parseSubdomain } from "../../server/utils/proxy";

describe("parseSubdomain", () => {
  const domain = "portable.127.0.0.1.nip.io";

  it("returns null for the main app domain (no subdomain)", () => {
    const result = parseSubdomain("portable.127.0.0.1.nip.io", domain);
    expect(result).toBeNull();
  });

  it("extracts slug and type 'editor' for a single subdomain", () => {
    const result = parseSubdomain("my-project.portable.127.0.0.1.nip.io", domain);
    expect(result).toEqual({ slug: "my-project", type: "editor" });
  });

  it("extracts slug and type 'preview' for preview subdomain", () => {
    const result = parseSubdomain("preview.my-project.portable.127.0.0.1.nip.io", domain);
    expect(result).toEqual({ slug: "my-project", type: "preview" });
  });

  it("handles Host header with port (strips port for matching)", () => {
    const result = parseSubdomain("my-project.portable.127.0.0.1.nip.io:3000", domain);
    expect(result).toEqual({ slug: "my-project", type: "editor" });
  });

  it("returns null for main domain with port", () => {
    const result = parseSubdomain("portable.127.0.0.1.nip.io:3000", domain);
    expect(result).toBeNull();
  });

  it("handles preview subdomain with port", () => {
    const result = parseSubdomain("preview.my-project.portable.127.0.0.1.nip.io:8080", domain);
    expect(result).toEqual({ slug: "my-project", type: "preview" });
  });

  it("returns null for empty host", () => {
    const result = parseSubdomain("", domain);
    expect(result).toBeNull();
  });

  it("handles a different base domain", () => {
    const result = parseSubdomain("my-app.example.com", "example.com");
    expect(result).toEqual({ slug: "my-app", type: "editor" });
  });

  it("handles preview with a different base domain", () => {
    const result = parseSubdomain("preview.my-app.example.com", "example.com");
    expect(result).toEqual({ slug: "my-app", type: "preview" });
  });

  it("returns null when host does not end with domain", () => {
    const result = parseSubdomain("my-project.other-domain.com", domain);
    expect(result).toBeNull();
  });
});

describe("getDomainFromBaseUrl", () => {
  it("extracts hostname from HTTP URL", () => {
    expect(getDomainFromBaseUrl("http://portable.127.0.0.1.nip.io")).toBe(
      "portable.127.0.0.1.nip.io",
    );
  });

  it("extracts hostname from HTTPS URL with port", () => {
    expect(getDomainFromBaseUrl("https://portable.example.com:8443")).toBe("portable.example.com");
  });

  it("extracts hostname from localhost URL", () => {
    expect(getDomainFromBaseUrl("http://localhost:3000")).toBe("localhost");
  });
});

describe("buildProxyTarget", () => {
  it("builds correct URL for editor (port 3000)", () => {
    const result = buildProxyTarget("my-project", "editor", "default");
    expect(result).toBe("http://project-my-project.default.svc.cluster.local:3000");
  });

  it("builds correct URL for preview (port 3001)", () => {
    const result = buildProxyTarget("my-project", "preview", "default");
    expect(result).toBe("http://project-my-project.default.svc.cluster.local:3001");
  });

  it("uses the provided namespace", () => {
    const result = buildProxyTarget("cool-app", "editor", "production");
    expect(result).toBe("http://project-cool-app.production.svc.cluster.local:3000");
  });
});
