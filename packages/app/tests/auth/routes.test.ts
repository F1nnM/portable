import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockEvent,
  deleteCookieStub,
  getCookieStub,
  sendRedirectStub,
  setCookieStub,
  setupH3Stubs,
} from "../helpers/h3";

// Stub Nitro auto-imports
setupH3Stubs();

// -- Mocks for auth utilities --
const mockDeleteSession = vi.fn();
const mockSessionCookieOptions = vi.fn(() => ({ httpOnly: true, path: "/" }));
const mockValidateSession = vi.fn();

vi.mock("../../server/utils/auth", () => ({
  deleteSession: mockDeleteSession,
  sessionCookieOptions: mockSessionCookieOptions,
  validateSession: mockValidateSession,
  useGitHubClient: () => ({
    createAuthorizationURL: (_state: string, _scopes: string[]) =>
      new URL("https://github.com/login/oauth/authorize?client_id=test&state=abc"),
  }),
}));

// -- Mock arctic --
vi.mock("arctic", () => ({
  generateState: () => "mock-state-token",
}));

// Dynamic imports
const githubRedirectHandler = (await import("../../server/routes/auth/github/index.get")).default;
const logoutHandler = (await import("../../server/routes/auth/logout.post")).default;
const meHandler = (await import("../../server/api/auth/me.get")).default;
const authMiddleware = (await import("../../server/middleware/auth")).default;

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login redirect", () => {
    it("redirects to github.com authorization URL and sets oauth_state cookie", async () => {
      const event = createMockEvent();
      await githubRedirectHandler(event as any);

      expect(sendRedirectStub).toHaveBeenCalledOnce();
      const redirectUrl = sendRedirectStub.mock.calls[0][1] as string;
      expect(redirectUrl).toContain("github.com");
      expect(redirectUrl).toContain("client_id=");

      expect(setCookieStub).toHaveBeenCalledWith(
        event,
        "github_oauth_state",
        "mock-state-token",
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe("logout", () => {
    it("deletes session, clears cookie, and returns ok", async () => {
      getCookieStub.mockReturnValueOnce("some-session-token");
      const event = createMockEvent();
      const result = await logoutHandler(event as any);

      expect(result).toEqual({ ok: true });
      expect(mockDeleteSession).toHaveBeenCalledWith("some-session-token");
      expect(deleteCookieStub).toHaveBeenCalledWith(
        event,
        "portable_session",
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe("auth me endpoint", () => {
    it("returns 401 when not authenticated", () => {
      const event = createMockEvent({ user: null });
      expect(() => meHandler(event as any)).toThrow(expect.objectContaining({ statusCode: 401 }));
    });

    it("returns user when authenticated", () => {
      const user = { id: "u1", githubId: 1, username: "test", avatarUrl: "https://a.com" };
      const event = createMockEvent({ user });
      const result = meHandler(event as any);
      expect(result).toEqual(user);
    });
  });

  describe("auth middleware", () => {
    it("sets event.context.user to null when no cookie", async () => {
      getCookieStub.mockReturnValueOnce(undefined);
      const event = createMockEvent();
      await authMiddleware(event as any);
      expect(event.context.user).toBeNull();
    });

    it("sets event.context.user from validated session", async () => {
      const user = { id: "u1", githubId: 1, username: "test", avatarUrl: "https://a.com" };
      getCookieStub.mockReturnValueOnce("valid-token");
      mockValidateSession.mockResolvedValueOnce(user);
      const event = createMockEvent();
      await authMiddleware(event as any);
      expect(event.context.user).toEqual(user);
    });
  });
});
