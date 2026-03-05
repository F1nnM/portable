import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import App from "../src/App.vue";

describe("editor smoke tests", () => {
  it("app.vue renders the heading", () => {
    const wrapper = mount(App);
    expect(wrapper.find("h1").text()).toBe("Portable Editor");
  });

  it("app.vue renders the subtitle", () => {
    const wrapper = mount(App);
    expect(wrapper.find("p").text()).toBe("Mobile-first code editor");
  });
});
