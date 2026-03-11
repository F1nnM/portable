import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock $fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

// eslint-disable-next-line ts/consistent-type-imports
type UseFiles = Awaited<typeof import("~/composables/useFiles")>["useFiles"];
let useFiles: UseFiles;

beforeEach(async () => {
  mockFetch.mockReset();
  const mod = await import("~/composables/useFiles");
  useFiles = mod.useFiles;
});

describe("useFiles", () => {
  it("fetches file list and builds tree", async () => {
    mockFetch.mockResolvedValueOnce({
      files: ["src/index.ts", "src/utils/helper.ts", "package.json", "README.md"],
    });

    const { tree, fetchFiles } = useFiles("my-project");
    await fetchFiles();

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/files");
    expect(tree.value).toHaveLength(3); // src/, package.json, README.md
  });

  it("builds nested directory structure", async () => {
    mockFetch.mockResolvedValueOnce({
      files: ["src/index.ts", "src/utils/helper.ts"],
    });

    const { tree, fetchFiles } = useFiles("my-project");
    await fetchFiles();

    const srcDir = tree.value.find((n) => n.name === "src");
    expect(srcDir).toBeDefined();
    expect(srcDir!.isDirectory).toBe(true);
    expect(srcDir!.children).toHaveLength(2); // index.ts, utils/
  });

  it("sorts directories before files", async () => {
    mockFetch.mockResolvedValueOnce({
      files: ["b.ts", "a/file.ts", "c.ts"],
    });

    const { tree, fetchFiles } = useFiles("my-project");
    await fetchFiles();

    expect(tree.value[0].name).toBe("a");
    expect(tree.value[0].isDirectory).toBe(true);
    expect(tree.value[1].name).toBe("b.ts");
    expect(tree.value[2].name).toBe("c.ts");
  });

  it("reads a file", async () => {
    mockFetch.mockResolvedValueOnce("const x = 1;");

    const { readFile } = useFiles("my-project");
    const content = await readFile("src/index.ts");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/my-project/pod/api/files/src/index.ts",
      expect.objectContaining({ responseType: "text" }),
    );
    expect(content).toBe("const x = 1;");
  });

  it("writes a file", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { writeFile } = useFiles("my-project");
    await writeFile("src/index.ts", "const x = 2;");

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/files/src/index.ts", {
      method: "PUT",
      body: "const x = 2;",
    });
  });

  it("handles empty file list", async () => {
    mockFetch.mockResolvedValueOnce({ files: [] });

    const { tree, fetchFiles } = useFiles("my-project");
    await fetchFiles();

    expect(tree.value).toHaveLength(0);
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { tree, fetchFiles } = useFiles("my-project");
    await fetchFiles();

    expect(tree.value).toHaveLength(0);
  });

  it("exposes flat file list", async () => {
    mockFetch.mockResolvedValueOnce({
      files: ["src/index.ts", "package.json"],
    });

    const { files, fetchFiles } = useFiles("my-project");
    await fetchFiles();

    expect(files.value).toEqual(["src/index.ts", "package.json"]);
  });
});
