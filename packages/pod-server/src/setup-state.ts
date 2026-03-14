export type SetupPhase =
  | "initializing"
  | "cloning"
  | "installing"
  | "building"
  | "starting_server"
  | "ready";

let phase: SetupPhase = "initializing";

export function getPhase(): SetupPhase {
  return phase;
}

export function setPhase(newPhase: SetupPhase): void {
  phase = newPhase;
}
