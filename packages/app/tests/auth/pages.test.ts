import { beforeEach, describe, expect, it, vi } from "vitest";

// -- Mock state refs --
const mockNavigateTo = vi.fn();
const mockRefresh = vi.fn();
const mockRefreshCredentialStatus = vi.fn();
const mockUser = { value: null as any };
const mockIsAuthenticated = { value: false };
const mockIsSetupComplete = { value: false };
const mockHasCredential = { value: null as boolean | null };
const mockHasAgeKey = { value: null as boolean | null };

// Mock Nuxt auto-imports resolved via #app/composables/router
vi.mock("#app/composables/router", () => ({
  // eslint-disable-next-line ts/no-unsafe-function-type
  defineNuxtRouteMiddleware: (fn: Function) => fn,
  navigateTo: (...args: any[]) => mockNavigateTo(...args),
}));

// Mock the useAuth composable (auto-imported by Nuxt from composables/)
vi.mock("../../composables/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    isSetupComplete: mockIsSetupComplete,
    hasCredential: mockHasCredential,
    hasAgeKey: mockHasAgeKey,
    refresh: mockRefresh,
    refreshCredentialStatus: mockRefreshCredentialStatus,
  }),
}));

const middleware = (await import("../../middleware/auth.global")).default;

describe("auth.global route middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = null;
    mockIsAuthenticated.value = false;
    mockIsSetupComplete.value = false;
    mockHasCredential.value = null;
    mockHasAgeKey.value = null;
  });

  it("redirects unauthenticated users to /login for protected routes", async () => {
    mockRefresh.mockResolvedValueOnce(undefined);
    await middleware({ path: "/settings" } as any, {} as any);
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });

  it("allows unauthenticated access to /login", async () => {
    mockRefresh.mockResolvedValueOnce(undefined);
    const result = await middleware({ path: "/login" } as any, {} as any);
    expect(mockNavigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("skips middleware for API routes", async () => {
    const result = await middleware({ path: "/api/health" } as any, {} as any);
    expect(result).toBeUndefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
