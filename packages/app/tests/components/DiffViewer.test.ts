import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import DiffViewer from "../../components/git/DiffViewer.vue";

const sampleDiff = `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,6 @@
 import { app } from "./app";

-const PORT = 3000;
+const PORT = process.env.PORT || 3000;
+const HOST = "0.0.0.0";

 app.listen(PORT);`;

describe("diffViewer", () => {
  it("renders filename in header", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    expect(wrapper.text()).toContain("src/index.ts");
  });

  it("shows back button", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    expect(wrapper.find(".btn-back").exists()).toBe(true);
  });

  it("emits back event on back button click", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    await wrapper.find(".btn-back").trigger("click");
    expect(wrapper.emitted("back")).toBeTruthy();
  });

  it("renders added lines with green highlighting", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    const addedLines = wrapper.findAll(".diff-line-added");
    expect(addedLines.length).toBeGreaterThan(0);
  });

  it("renders removed lines with red highlighting", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    const removedLines = wrapper.findAll(".diff-line-removed");
    expect(removedLines.length).toBeGreaterThan(0);
  });

  it("renders context lines without highlighting", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    const contextLines = wrapper.findAll(".diff-line-context");
    expect(contextLines.length).toBeGreaterThan(0);
  });

  it("renders diff hunk headers", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    const hunkHeaders = wrapper.findAll(".diff-hunk-header");
    expect(hunkHeaders.length).toBeGreaterThan(0);
  });

  it("emits viewFile event when view full file link is clicked", async () => {
    const wrapper = await mountSuspended(DiffViewer, {
      props: { filename: "src/index.ts", diff: sampleDiff },
    });
    await wrapper.find(".btn-view-file").trigger("click");
    expect(wrapper.emitted("viewFile")).toBeTruthy();
    expect(wrapper.emitted("viewFile")![0]).toEqual(["src/index.ts"]);
  });
});
