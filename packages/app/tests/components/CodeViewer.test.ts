import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import CodeViewer from "../../components/files/CodeViewer.vue";

describe("codeViewer", () => {
  it("renders filename in header", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: true },
    });
    expect(wrapper.text()).toContain("test.ts");
  });

  it("shows back button", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: true },
    });
    expect(wrapper.find(".btn-back").exists()).toBe(true);
  });

  it("emits back event when back button is clicked", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: true },
    });
    await wrapper.find(".btn-back").trigger("click");
    expect(wrapper.emitted("back")).toBeTruthy();
  });

  it("shows edit toggle button", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: true },
    });
    expect(wrapper.find(".btn-edit").exists()).toBe(true);
  });

  it("shows save button when editing", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: false },
    });
    expect(wrapper.find(".btn-save").exists()).toBe(true);
  });

  it("emits save event when save button is clicked", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: false },
    });
    await wrapper.find(".btn-save").trigger("click");
    expect(wrapper.emitted("save")).toBeTruthy();
  });

  it("emits toggleEdit event when edit button is clicked", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: true },
    });
    await wrapper.find(".btn-edit").trigger("click");
    expect(wrapper.emitted("toggleEdit")).toBeTruthy();
  });

  it("renders the editor container", async () => {
    const wrapper = await mountSuspended(CodeViewer, {
      props: { filename: "test.ts", content: "const x = 1;", readOnly: true },
    });
    expect(wrapper.find(".editor-container").exists()).toBe(true);
  });
});
