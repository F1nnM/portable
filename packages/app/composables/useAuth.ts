import type { SessionUser } from "~/server/utils/auth";

interface AuthState {
  user: Ref<SessionUser | null>;
  isAuthenticated: ComputedRef<boolean>;
  hasCredential: Ref<boolean | null>;
  hasAgeKey: Ref<boolean | null>;
  isSetupComplete: ComputedRef<boolean>;
  refresh: () => Promise<SessionUser | null>;
  refreshCredentialStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const user = useState<SessionUser | null>("auth:user", () => null);
  const hasCredential = useState<boolean | null>("auth:hasCredential", () => null);
  const hasAgeKey = useState<boolean | null>("auth:hasAgeKey", () => null);

  const isAuthenticated = computed(() => !!user.value);
  const isSetupComplete = computed(() => hasCredential.value === true && hasAgeKey.value === true);

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

  async function refreshCredentialStatus(): Promise<void> {
    try {
      const [credResult, ageResult] = await Promise.all([
        $fetch<{ hasCredential: boolean }>("/api/settings/credential"),
        $fetch<{ hasAgeKey: boolean }>("/api/settings/age-key"),
      ]);
      hasCredential.value = credResult.hasCredential;
      hasAgeKey.value = ageResult.hasAgeKey;
    } catch {
      // If we can't fetch, leave as null (unknown)
    }
  }

  async function logout(): Promise<void> {
    await $fetch("/auth/logout", { method: "POST" });
    user.value = null;
    hasCredential.value = null;
    hasAgeKey.value = null;
    navigateTo("/login");
  }

  return {
    user,
    isAuthenticated,
    hasCredential,
    hasAgeKey,
    isSetupComplete,
    refresh,
    refreshCredentialStatus,
    logout,
  };
}
