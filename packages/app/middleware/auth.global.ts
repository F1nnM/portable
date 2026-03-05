export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check for API routes and auth routes (handled server-side)
  if (to.path.startsWith("/api/") || to.path.startsWith("/auth/")) {
    return;
  }

  const { user, refresh } = useAuth();

  // On first load (SSR or client hydration), fetch the auth state
  if (user.value === null) {
    await refresh();
  }

  const isPublicRoute = to.path === "/login";

  if (!user.value && !isPublicRoute) {
    return navigateTo("/login");
  }

  if (user.value && isPublicRoute) {
    return navigateTo("/");
  }
});
