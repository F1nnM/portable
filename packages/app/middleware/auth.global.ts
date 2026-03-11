export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for server API routes and auth callbacks
  if (to.path.startsWith("/api/") || to.path.startsWith("/auth/")) return;

  const { user, isAuthenticated, isSetupComplete, refresh, refreshCredentialStatus } = useAuth();

  // On first load, fetch auth state
  if (user.value === null && !isAuthenticated.value) {
    await refresh();
  }

  const publicRoutes = ["/login"];
  const isPublic = publicRoutes.includes(to.path);

  // Unauthenticated: redirect to login
  if (!isAuthenticated.value && !isPublic) {
    return navigateTo("/login");
  }

  // Authenticated on login page: redirect to dashboard
  if (isAuthenticated.value && to.path === "/login") {
    return navigateTo("/");
  }

  // If authenticated, check credential status for onboarding gating
  if (isAuthenticated.value && to.path !== "/onboarding") {
    // Lazy-load credential status if not yet fetched
    const { hasCredential, hasAgeKey } = useAuth();
    if (hasCredential.value === null || hasAgeKey.value === null) {
      await refreshCredentialStatus();
    }
    if (!isSetupComplete.value) {
      return navigateTo("/onboarding");
    }
  }
});
