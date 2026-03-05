import type { SessionUser } from "../server/utils/auth";

export function useAuth() {
  const user = useState<SessionUser | null>("auth-user", () => null);
  const isAuthenticated = computed(() => user.value !== null);

  async function refresh(): Promise<SessionUser | null> {
    try {
      const data = await $fetch<SessionUser>("/api/auth/me");
      user.value = data;
      return data;
    } catch {
      user.value = null;
      return null;
    }
  }

  async function logout(): Promise<void> {
    await $fetch("/auth/logout", { method: "POST" });
    user.value = null;
    await navigateTo("/login");
  }

  return {
    user,
    isAuthenticated,
    refresh,
    logout,
  };
}
