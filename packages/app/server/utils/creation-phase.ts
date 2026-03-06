export type CreationPhase = "creating_database" | "creating_repository" | "pushing_scaffold";

const creationPhases = new Map<string, CreationPhase>();

export function getCreationPhase(slug: string): CreationPhase | undefined {
  return creationPhases.get(slug);
}

export function setCreationPhase(slug: string, phase: CreationPhase): void {
  creationPhases.set(slug, phase);
}

export function clearCreationPhase(slug: string): void {
  creationPhases.delete(slug);
}
