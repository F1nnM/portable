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

function mockLocation(hostname: string, protocol = "https:", port = "") {
  const loc = {
    hostname,
    protocol,
    port,
    href: `${protocol}//${hostname}${port ? `:${port}` : ""}`,
    origin: `${protocol}//${hostname}${port ? `:${port}` : ""}`,
    host: `${hostname}${port ? `:${port}` : ""}`,
    pathname: "/",
    search: "",
    hash: "",
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
    toString: () => `${protocol}//${hostname}${port ? `:${port}` : ""}`,
    ancestorOrigins: { length: 0, contains: () => false, item: () => null },
  };
  vi.stubGlobal("location", loc);
}

describe("preview view", () => {
  beforeEach(() => {
    mockLocation("myproject.portable.dev");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("iframe src constructed correctly from current hostname", async () => {
    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const iframe = wrapper.find("iframe");
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes("src")).toBe("https://preview.myproject.portable.dev");
  });

  it("constructs iframe src with non-standard port", async () => {
    mockLocation("myproject.portable.dev", "http:", "8080");

    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const iframe = wrapper.find("iframe");
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes("src")).toBe("http://preview.myproject.portable.dev:8080");
  });

  it("renders iframe element", async () => {
    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const iframe = wrapper.find("iframe");
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes("data-testid")).toBe("preview-iframe");
  });

  it("refresh button reloads iframe", async () => {
    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const iframe = wrapper.find("iframe");
    const originalSrc = iframe.attributes("src");
    expect(originalSrc).toBe("https://preview.myproject.portable.dev");

    const refreshBtn = wrapper.find("[data-testid='preview-refresh']");
    expect(refreshBtn.exists()).toBe(true);

    await refreshBtn.trigger("click");
    await flushPromises();

    // After refresh, iframe src should still point to the same URL
    // (implementation resets src to trigger reload)
    const newSrc = wrapper.find("iframe").attributes("src");
    expect(newSrc).toBe("https://preview.myproject.portable.dev");
  });

  it("shows preview URL in header", async () => {
    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const urlDisplay = wrapper.find("[data-testid='preview-url']");
    expect(urlDisplay.exists()).toBe(true);
    expect(urlDisplay.text()).toContain("preview.myproject.portable.dev");
  });

  it("shows header bar with Preview label", async () => {
    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const header = wrapper.find("[data-testid='preview-header']");
    expect(header.exists()).toBe(true);
    expect(header.text()).toContain("Preview");
  });

  it("retains preview-view testid and classes", async () => {
    const router = createTestRouter();
    router.push("/preview");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    const view = wrapper.find("[data-testid='preview-view']");
    expect(view.exists()).toBe(true);
    expect(view.classes()).toContain("view");
    expect(view.classes()).toContain("preview-view");
  });
});
