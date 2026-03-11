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

export interface GitStatus {
  branch: string;
  commits: GitCommit[];
  staged: GitFileChange[];
  unstaged: GitFileChange[];
}

export function useGit(slug: string) {
  const branch = ref("");
  const commits = ref<GitCommit[]>([]);
  const staged = ref<GitFileChange[]>([]);
  const unstaged = ref<GitFileChange[]>([]);
  const loading = ref(false);

  async function fetchGitStatus(): Promise<void> {
    loading.value = true;
    try {
      const data = await $fetch<GitStatus>(`/api/projects/${slug}/pod/api/git`);
      branch.value = data.branch;
      commits.value = data.commits;
      staged.value = data.staged;
      unstaged.value = data.unstaged;
    } catch {
      // Leave unchanged on error
    } finally {
      loading.value = false;
    }
  }

  return {
    branch,
    commits,
    staged,
    unstaged,
    loading,
    fetchGitStatus,
  };
}
