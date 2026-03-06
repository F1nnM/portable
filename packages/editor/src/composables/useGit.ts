import { computed, ref } from "vue";

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitState {
  branch: string;
  commits: GitCommit[];
  staged: GitFileChange[];
  unstaged: GitFileChange[];
}

// Module-level state: shared across all useGit() callers
const gitState = ref<GitState | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

export function useGit() {
  async function fetchGitState(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/git");
      if (!res.ok) {
        throw new Error(`Failed to fetch git state: ${res.status}`);
      }
      gitState.value = (await res.json()) as GitState;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    gitState.value = null;
    loading.value = false;
    error.value = null;
  }

  return {
    gitState: computed(() => gitState.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchGitState,
    reset,
  };
}
