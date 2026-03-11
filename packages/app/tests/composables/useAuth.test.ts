import { describe, expect, it } from "vitest";

describe("useAuth composable", () => {
  it("exports useAuth function", async () => {
    // Verify the composable module exists and exports correctly
    const mod = await import("../../composables/useAuth");
    expect(mod.useAuth).toBeDefined();
    expect(typeof mod.useAuth).toBe("function");
  });
});
