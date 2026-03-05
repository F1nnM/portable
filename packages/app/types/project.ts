export interface Project {
  id: string;
  name: string;
  slug: string;
  scaffoldId: string;
  status: "stopped" | "starting" | "running" | "stopping" | "error";
  createdAt: string;
  updatedAt: string;
}
