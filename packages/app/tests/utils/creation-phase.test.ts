import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCreationPhase,
  getCreationPhase,
  setCreationPhase,
} from "../../server/utils/creation-phase";

describe("creation-phase", () => {
  beforeEach(() => {
    clearCreationPhase("test-slug");
  });

  it("returns undefined for unknown slug", () => {
    expect(getCreationPhase("unknown")).toBeUndefined();
  });

  it("stores and retrieves a creation phase", () => {
    setCreationPhase("test-slug", "creating_database");
    expect(getCreationPhase("test-slug")).toBe("creating_database");
  });

  it("overwrites existing phase", () => {
    setCreationPhase("test-slug", "creating_database");
    setCreationPhase("test-slug", "creating_repository");
    expect(getCreationPhase("test-slug")).toBe("creating_repository");
  });

  it("clears the phase", () => {
    setCreationPhase("test-slug", "pushing_scaffold");
    clearCreationPhase("test-slug");
    expect(getCreationPhase("test-slug")).toBeUndefined();
  });

  it("tracks multiple slugs independently", () => {
    setCreationPhase("slug-a", "creating_database");
    setCreationPhase("slug-b", "pushing_scaffold");
    expect(getCreationPhase("slug-a")).toBe("creating_database");
    expect(getCreationPhase("slug-b")).toBe("pushing_scaffold");
    clearCreationPhase("slug-a");
    clearCreationPhase("slug-b");
  });
});
