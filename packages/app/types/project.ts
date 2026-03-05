export interface Project {
  id: string;
  name: string;
  slug: string;
  scaffoldId: string;
  status: "stopped" | "starting" | "running" | "stopping" | "error";
  repoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
