import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../src/App.vue";
import { routes } from "../src/router";

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe("editor navigation", () => {
  it("bottom nav renders four tabs (Chat, Files, Git, Preview)", async () => {
    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const tabs = wrapper.findAll("[data-testid='nav-tab']");
    expect(tabs).toHaveLength(4);

    const labels = tabs.map((t) => t.text());
    expect(labels).toContain("Chat");
    expect(labels).toContain("Files");
    expect(labels).toContain("Git");
    expect(labels).toContain("Preview");
  });

  it("tab switching shows correct view", async () => {
    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    // Start on ChatView
    expect(wrapper.find("[data-testid='chat-view']").exists()).toBe(true);

    // Click Files tab
    const filesTab = wrapper
      .findAll("[data-testid='nav-tab']")
      .find((t) => t.text().includes("Files"));
    expect(filesTab).toBeDefined();
    await filesTab!.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid='files-view']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='chat-view']").exists()).toBe(false);

    // Click Preview tab
    const previewTab = wrapper
      .findAll("[data-testid='nav-tab']")
      .find((t) => t.text().includes("Preview"));
    expect(previewTab).toBeDefined();
    await previewTab!.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid='preview-view']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='files-view']").exists()).toBe(false);
  });

  it("active tab is highlighted", async () => {
    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    // Chat tab should be active
    const chatTab = wrapper
      .findAll("[data-testid='nav-tab']")
      .find((t) => t.text().includes("Chat"));
    expect(chatTab!.classes()).toContain("active");

    // Files tab should not be active
    const filesTab = wrapper
      .findAll("[data-testid='nav-tab']")
      .find((t) => t.text().includes("Files"));
    expect(filesTab!.classes()).not.toContain("active");

    // Navigate to Files
    await filesTab!.trigger("click");
    await flushPromises();

    // Now Files should be active and Chat should not
    const updatedFilesTab = wrapper
      .findAll("[data-testid='nav-tab']")
      .find((t) => t.text().includes("Files"));
    const updatedChatTab = wrapper
      .findAll("[data-testid='nav-tab']")
      .find((t) => t.text().includes("Chat"));

    expect(updatedFilesTab!.classes()).toContain("active");
    expect(updatedChatTab!.classes()).not.toContain("active");
  });

  it("default route shows ChatView", async () => {
    const router = createTestRouter();
    router.push("/");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    expect(wrapper.find("[data-testid='chat-view']").exists()).toBe(true);
  });
});
