export interface BuildState {
  lastBuiltCommit: string | null;
  isBuilding: boolean;
  lastBuildError: string | null;
}

let lastBuiltCommit: string | null = null;
let isBuilding = false;
let lastBuildError: string | null = null;

export function getBuildState(): BuildState {
  return { lastBuiltCommit, isBuilding, lastBuildError };
}

export function setLastBuiltCommit(commit: string): void {
  lastBuiltCommit = commit;
}

export function setBuildingState(building: boolean): void {
  isBuilding = building;
}

export function setLastBuildError(error: string | null): void {
  lastBuildError = error;
}

export function resetBuildState(): void {
  lastBuiltCommit = null;
  isBuilding = false;
  lastBuildError = null;
}
