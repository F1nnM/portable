import type { GitStatus } from "~/types/git";

export function useGit(slug: Ref<string> | string) {
  const slugValue = () => (typeof slug === "string" ? slug : slug.value);

  const gitData = ref<GitStatus | null>(null);
  const loading = ref(false);
  const error = ref("");
  const actionLoading = ref<string | null>(null);
  const actionError = ref("");

  function podApiUrl(path: string): string {
    return `/api/projects/${slugValue()}/pod${path}`;
  }

  async function fetchGitStatus(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const data = await $fetch<GitStatus>(podApiUrl("/api/git"));
      gitData.value = data;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Failed to load git status";
    } finally {
      loading.value = false;
    }
  }

  async function stageFiles(paths: string[]): Promise<boolean> {
    actionLoading.value = "stage";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/stage"), {
        method: "POST",
        body: { paths },
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to stage files";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  async function stageAll(): Promise<boolean> {
    actionLoading.value = "stage";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/stage"), {
        method: "POST",
        body: { all: true },
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to stage files";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  async function unstageFiles(paths: string[]): Promise<boolean> {
    actionLoading.value = "unstage";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/unstage"), {
        method: "POST",
        body: { paths },
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to unstage files";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  async function unstageAll(): Promise<boolean> {
    actionLoading.value = "unstage";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/unstage"), {
        method: "POST",
        body: { all: true },
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to unstage files";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  async function commit(message: string): Promise<boolean> {
    actionLoading.value = "commit";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/commit"), {
        method: "POST",
        body: { message },
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to commit";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  async function push(): Promise<boolean> {
    actionLoading.value = "push";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/push"), {
        method: "POST",
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to push";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  async function pull(): Promise<boolean> {
    actionLoading.value = "pull";
    actionError.value = "";
    try {
      await $fetch(podApiUrl("/api/git/pull"), {
        method: "POST",
      });
      await fetchGitStatus();
      return true;
    } catch (err: unknown) {
      actionError.value = err instanceof Error ? err.message : "Failed to pull";
      return false;
    } finally {
      actionLoading.value = null;
    }
  }

  return {
    gitData,
    loading,
    error,
    actionLoading,
    actionError,
    fetchGitStatus,
    stageFiles,
    stageAll,
    unstageFiles,
    unstageAll,
    commit,
    push,
    pull,
  };
}
