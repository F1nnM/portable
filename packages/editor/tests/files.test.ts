import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../src/App.vue";
import { useFiles } from "../src/composables/useFiles";
import { routes } from "../src/router";

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

const mockFiles = {
  files: [
    "package.json",
    "src/App.vue",
    "src/main.ts",
    "src/components/FileTree.vue",
    "src/views/FilesView.vue",
    "README.md",
  ],
};

const mockFileContent = 'console.log("hello world");';

describe("files view", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useFiles().reset();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("file tree fetched and rendered", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFiles),
    });

    const router = createTestRouter();
    router.push("/files");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    const filesView = wrapper.find("[data-testid='files-view']");
    expect(filesView.exists()).toBe(true);

    // Should have fetched the file list
    expect(fetchSpy).toHaveBeenCalledWith("/api/files");

    // Should render file tree items
    const treeItems = wrapper.findAll("[data-testid='file-tree-item']");
    expect(treeItems.length).toBeGreaterThan(0);

    // Should contain directories and files
    const itemTexts = treeItems.map((item) => item.text());
    expect(itemTexts.some((t) => t.includes("src"))).toBe(true);
    expect(itemTexts.some((t) => t.includes("package.json"))).toBe(true);
  });

  it("tap file navigates to viewer", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFileContent),
      });

    const router = createTestRouter();
    router.push("/files");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Click a file item (not a directory)
    const fileItems = wrapper.findAll("[data-testid='file-tree-item']");
    const fileItem = fileItems.find(
      (item) => item.text().includes("package") && !item.text().includes("src"),
    );
    expect(fileItem).toBeDefined();
    await fileItem!.trigger("click");
    await flushPromises();

    // CodeViewer should now be visible
    expect(wrapper.find("[data-testid='code-viewer']").exists()).toBe(true);
    // File tree should be hidden
    expect(wrapper.find("[data-testid='file-tree']").exists()).toBe(false);
  });

  it("codemirror container renders when file is opened", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFileContent),
      });

    const router = createTestRouter();
    router.push("/files");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Click a file to open it
    const fileItems = wrapper.findAll("[data-testid='file-tree-item']");
    const fileItem = fileItems.find((item) => item.text().includes("package"));
    await fileItem!.trigger("click");
    await flushPromises();

    // CodeMirror container should exist
    expect(wrapper.find("[data-testid='codemirror-container']").exists()).toBe(true);
  });

  it("edit toggle switches mode", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFileContent),
      });

    const router = createTestRouter();
    router.push("/files");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Open a file
    const fileItems = wrapper.findAll("[data-testid='file-tree-item']");
    const fileItem = fileItems.find((item) => item.text().includes("package"));
    await fileItem!.trigger("click");
    await flushPromises();

    // Should start in read-only mode
    const editBtn = wrapper.find("[data-testid='edit-toggle']");
    expect(editBtn.exists()).toBe(true);

    // Save button should not be visible in read-only mode
    expect(wrapper.find("[data-testid='save-btn']").exists()).toBe(false);

    // Click edit toggle
    await editBtn.trigger("click");
    await flushPromises();

    // Save button should now be visible
    expect(wrapper.find("[data-testid='save-btn']").exists()).toBe(true);
  });

  it("save calls PUT API", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFileContent),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

    const router = createTestRouter();
    router.push("/files");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Open a file
    const fileItems = wrapper.findAll("[data-testid='file-tree-item']");
    const fileItem = fileItems.find((item) => item.text().includes("package"));
    await fileItem!.trigger("click");
    await flushPromises();

    // Toggle edit mode
    await wrapper.find("[data-testid='edit-toggle']").trigger("click");
    await flushPromises();

    // Click save
    await wrapper.find("[data-testid='save-btn']").trigger("click");
    await flushPromises();

    // Verify PUT was called
    const putCall = fetchSpy.mock.calls.find(
      (call: unknown[]) => call[1] && (call[1] as RequestInit).method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(putCall![0]).toBe("/api/files/package.json");
    expect((putCall![1] as RequestInit).method).toBe("PUT");
  });

  it("back returns to tree", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFileContent),
      });

    const router = createTestRouter();
    router.push("/files");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Open a file
    const fileItems = wrapper.findAll("[data-testid='file-tree-item']");
    const fileItem = fileItems.find((item) => item.text().includes("package"));
    await fileItem!.trigger("click");
    await flushPromises();

    // Should be in viewer mode
    expect(wrapper.find("[data-testid='code-viewer']").exists()).toBe(true);

    // Click back button
    const backBtn = wrapper.find("[data-testid='back-btn']");
    expect(backBtn.exists()).toBe(true);
    await backBtn.trigger("click");
    await flushPromises();

    // Should be back in tree mode
    expect(wrapper.find("[data-testid='file-tree']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='code-viewer']").exists()).toBe(false);
  });
});
