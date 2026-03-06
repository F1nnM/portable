export interface Project {
  id: string;
  name: string;
  slug: string;
  scaffoldId: string | null;
  status: "stopped" | "creating" | "starting" | "running" | "stopping" | "error";
  repoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
