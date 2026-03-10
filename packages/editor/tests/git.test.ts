import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../src/App.vue";
import { routes } from "../src/router";

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

const mockGitData = {
  branch: "main",
  commits: [
    {
      hash: "abc123def456",
      shortHash: "abc123d",
      message: "Add new feature",
      author: "Test User",
      date: "2026-03-07T10:00:00Z",
    },
    {
      hash: "789012fed345",
      shortHash: "789012f",
      message: "Initial commit",
      author: "Test User",
      date: "2026-03-06T10:00:00Z",
    },
  ],
  staged: [{ path: "src/new.ts", status: "added" }],
  unstaged: [
    { path: "README.md", status: "modified" },
    { path: "untracked.txt", status: "untracked" },
  ],
};

describe("git view", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders git view with branch and commits", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGitData),
    });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    const gitView = wrapper.find("[data-testid='git-view']");
    expect(gitView.exists()).toBe(true);

    // Should fetch git data
    expect(fetchSpy).toHaveBeenCalledWith("/api/git");

    // Should show branch name
    expect(wrapper.text()).toContain("main");

    // Should show commits
    expect(wrapper.text()).toContain("Add new feature");
    expect(wrapper.text()).toContain("Initial commit");
  });

  it("shows staged and unstaged files", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGitData),
    });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Should show staged files
    expect(wrapper.text()).toContain("src/new.ts");

    // Should show unstaged files
    expect(wrapper.text()).toContain("README.md");
    expect(wrapper.text()).toContain("untracked.txt");
  });

  it("clicking a changed file navigates to files view", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGitData),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("file content"),
      });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Click on a changed file
    const fileItems = wrapper.findAll("[data-testid='git-file-item']");
    expect(fileItems.length).toBeGreaterThan(0);

    await fileItems[0].trigger("click");
    await flushPromises();

    // Should navigate to files view
    expect(router.currentRoute.value.path).toBe("/files");
  });

  it("git tab appears in navigation", async () => {
    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const tabs = wrapper.findAll("[data-testid='nav-tab']");
    const labels = tabs.map((t) => t.text());
    expect(labels).toContain("Git");
  });

  it("shows commit short hash and relative time", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGitData),
    });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    // Should show short hash
    expect(wrapper.text()).toContain("abc123d");
  });

  it("formats commit time as 'just now' for recent timestamps", async () => {
    const recentDate = new Date(Date.now() - 10 * 1000).toISOString(); // 10 seconds ago
    const gitData = {
      branch: "main",
      commits: [
        {
          hash: "aaa111",
          shortHash: "aaa111",
          message: "Recent commit",
          author: "Dev",
          date: recentDate,
        },
      ],
      staged: [],
      unstaged: [],
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(gitData),
    });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("just now");
  });

  it("formats commit time as minutes ago", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const gitData = {
      branch: "main",
      commits: [
        {
          hash: "bbb222",
          shortHash: "bbb222",
          message: "Five min commit",
          author: "Dev",
          date: fiveMinAgo,
        },
      ],
      staged: [],
      unstaged: [],
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(gitData),
    });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("5m ago");
  });

  it("formats commit time as hours ago", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const gitData = {
      branch: "main",
      commits: [
        {
          hash: "ccc333",
          shortHash: "ccc333",
          message: "Three hour commit",
          author: "Dev",
          date: threeHoursAgo,
        },
      ],
      staged: [],
      unstaged: [],
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(gitData),
    });

    const router = createTestRouter();
    router.push("/git");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("3h ago");
  });
});
