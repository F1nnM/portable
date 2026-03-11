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
