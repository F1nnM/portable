import * as arctic from "arctic";
import { describe, expect, it } from "vitest";
import { createGitHubClient } from "../../server/utils/auth";

describe("auth utilities", () => {
  describe("createGitHubClient", () => {
    it("returns a GitHub instance", () => {
      const client = createGitHubClient("test-client-id", "test-client-secret", "http://localhost");
      expect(client).toBeInstanceOf(arctic.GitHub);
    });
  });
});
