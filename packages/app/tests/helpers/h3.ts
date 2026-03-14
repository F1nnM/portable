/**
 * Shared test helper for stubbing H3/Nitro auto-imports used by server handlers.
 *
 * Usage: call `setupH3Stubs()` before dynamic-importing any handler module, e.g.
 *
 *   setupH3Stubs();
 *   const handler = (await import("../../server/api/foo.get")).default;
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// createError – produces a real Error with statusCode / statusMessage
// ---------------------------------------------------------------------------
export const createErrorStub = vi.fn(
  (opts: { statusCode: number; statusMessage: string; message?: string }) => {
    const err = new Error(opts.message || opts.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  },
);

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------
export const getCookieStub = vi.fn();
export const setCookieStub = vi.fn();
export const deleteCookieStub = vi.fn();

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------
export const readBodyStub = vi.fn();
export const getQueryStub = vi.fn(() => ({}));
export const getRouterParamStub = vi.fn();
export const setResponseStatusStub = vi.fn();
export const sendRedirectStub = vi.fn();

// ---------------------------------------------------------------------------
// defineEventHandler – passthrough so `default` export IS the handler fn
// ---------------------------------------------------------------------------
// eslint-disable-next-line ts/no-unsafe-function-type
export const defineEventHandlerStub = vi.fn((fn: Function) => fn);

// ---------------------------------------------------------------------------
// useRuntimeConfig
// ---------------------------------------------------------------------------
export const useRuntimeConfigStub = vi.fn(() => ({}));

// ---------------------------------------------------------------------------
// Install all stubs globally (mimics Nitro auto-imports)
// ---------------------------------------------------------------------------
export function setupH3Stubs() {
  vi.stubGlobal("createError", createErrorStub);
  vi.stubGlobal("getCookie", getCookieStub);
  vi.stubGlobal("setCookie", setCookieStub);
  vi.stubGlobal("deleteCookie", deleteCookieStub);
  vi.stubGlobal("readBody", readBodyStub);
  vi.stubGlobal("getQuery", getQueryStub);
  vi.stubGlobal("getRouterParam", getRouterParamStub);
  vi.stubGlobal("setResponseStatus", setResponseStatusStub);
  vi.stubGlobal("sendRedirect", sendRedirectStub);
  vi.stubGlobal("defineEventHandler", defineEventHandlerStub);
  vi.stubGlobal("useRuntimeConfig", useRuntimeConfigStub);
}

// ---------------------------------------------------------------------------
// Mock H3 event factory
// ---------------------------------------------------------------------------
export function createMockEvent(
  overrides: {
    user?: { id: string; githubId: number; username: string; avatarUrl: string } | null;
    cookie?: Record<string, string>;
  } = {},
) {
  return {
    context: {
      user: overrides.user ?? null,
    },
    node: { req: {}, res: {} },
    _cookie: overrides.cookie ?? {},
  };
}
