/**
 * Global unhandled rejection handler.
 *
 * Prevents the process from crashing on transient "socket hang up" errors
 * that occur during Nuxt dev mode startup when internal HTTP connections
 * are disrupted by Nitro rebuilds.
 */
const HANDLER_KEY = "__portable_unhandled_rejection_handler";

export default defineNitroPlugin(() => {
  // Guard against multiple registrations during Nitro dev reloads
  if ((globalThis as Record<string, unknown>)[HANDLER_KEY]) return;
  (globalThis as Record<string, unknown>)[HANDLER_KEY] = true;

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);

    if (message === "socket hang up") {
      console.warn("[error-handler] Suppressed transient socket hang up");
      return;
    }

    // Let other unhandled rejections crash as normal
    console.error("[error-handler] Unhandled rejection:", reason);
    process.exit(1);
  });
});
