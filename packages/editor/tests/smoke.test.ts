import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../src/App.vue";
import { routes } from "../src/router";

describe("editor smoke tests", () => {
  it("app mounts with tab bar navigation", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    });
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    expect(wrapper.find(".tab-bar").exists()).toBe(true);
  });

  it("app renders router-view content", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    });
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [router] },
    });

    expect(wrapper.find("[data-testid='chat-view']").exists()).toBe(true);
  });
});
