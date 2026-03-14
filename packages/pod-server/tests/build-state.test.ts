import { beforeEach, describe, expect, it } from "vitest";
import {
  getBuildState,
  resetBuildState,
  setBuildingState,
  setLastBuildError,
  setLastBuiltCommit,
} from "../src/build-state.js";

describe("build-state", () => {
  beforeEach(() => {
    resetBuildState();
  });

  it("has correct initial state", () => {
    const state = getBuildState();
    expect(state).toEqual({
      lastBuiltCommit: null,
      isBuilding: false,
      lastBuildError: null,
    });
  });

  it("setLastBuiltCommit updates lastBuiltCommit", () => {
    setLastBuiltCommit("abc123");
    const state = getBuildState();
    expect(state.lastBuiltCommit).toBe("abc123");
  });

  it("setBuildingState updates isBuilding", () => {
    setBuildingState(true);
    expect(getBuildState().isBuilding).toBe(true);

    setBuildingState(false);
    expect(getBuildState().isBuilding).toBe(false);
  });

  it("setLastBuildError updates lastBuildError", () => {
    setLastBuildError("something went wrong");
    expect(getBuildState().lastBuildError).toBe("something went wrong");

    setLastBuildError(null);
    expect(getBuildState().lastBuildError).toBeNull();
  });

  it("resetBuildState returns all values to initial state", () => {
    setLastBuiltCommit("def456");
    setBuildingState(true);
    setLastBuildError("error");

    resetBuildState();

    expect(getBuildState()).toEqual({
      lastBuiltCommit: null,
      isBuilding: false,
      lastBuildError: null,
    });
  });

  it("getBuildState reflects the most recent setter calls", () => {
    setLastBuiltCommit("commit1");
    setBuildingState(true);
    setLastBuildError("err1");

    expect(getBuildState()).toEqual({
      lastBuiltCommit: "commit1",
      isBuilding: true,
      lastBuildError: "err1",
    });

    setLastBuiltCommit("commit2");
    setLastBuildError(null);

    expect(getBuildState()).toEqual({
      lastBuiltCommit: "commit2",
      isBuilding: true,
      lastBuildError: null,
    });
  });
});
