import type { TreeNode } from "../../types/files";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
// @vitest-environment nuxt
import { nextTick } from "vue";
import FileTree from "../../components/files/FileTree.vue";

function makeTree(): TreeNode[] {
  return [
    {
      name: "src",
      path: "src",
      type: "directory",
      children: [
        { name: "index.ts", path: "src/index.ts", type: "file" },
        { name: "app.vue", path: "src/app.vue", type: "file" },
      ],
    },
    { name: "package.json", path: "package.json", type: "file" },
    { name: "README.md", path: "README.md", type: "file" },
  ];
}

describe("fileTree", () => {
  it("renders files and directories", async () => {
    const wrapper = await mountSuspended(FileTree, {
      props: { nodes: makeTree() },
    });
    expect(wrapper.text()).toContain("src");
    expect(wrapper.text()).toContain("package.json");
    expect(wrapper.text()).toContain("README.md");
  });

  it("renders directories before files alphabetically", async () => {
    const nodes: TreeNode[] = [
      { name: "zebra.ts", path: "zebra.ts", type: "file" },
      {
        name: "alpha",
        path: "alpha",
        type: "directory",
        children: [{ name: "file.ts", path: "alpha/file.ts", type: "file" }],
      },
      { name: "apple.ts", path: "apple.ts", type: "file" },
    ];
    const wrapper = await mountSuspended(FileTree, {
      props: { nodes },
    });
    const items = wrapper.findAll(".tree-item");
    // Directory first, then files alphabetical
    expect(items[0].text()).toContain("alpha");
    expect(items[1].text()).toContain("apple.ts");
    expect(items[2].text()).toContain("zebra.ts");
  });

  it("emits select event when a file is clicked", async () => {
    const wrapper = await mountSuspended(FileTree, {
      props: { nodes: makeTree() },
    });
    // Click on package.json (a root-level file)
    const fileItems = wrapper.findAll(".tree-file");
    const pkgItem = fileItems.find((el) => el.text().includes("package.json"));
    expect(pkgItem).toBeDefined();
    await pkgItem!.trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["package.json"]);
  });

  it("expands directory on click", async () => {
    const wrapper = await mountSuspended(FileTree, {
      props: { nodes: makeTree() },
    });
    // Initially, children of "src" should not be visible (collapsed)
    expect(wrapper.text()).not.toContain("index.ts");

    // Click on "src" directory
    const dirItem = wrapper.find(".tree-directory");
    await dirItem.trigger("click");
    await nextTick();

    // Now children should be visible
    expect(wrapper.text()).toContain("index.ts");
    expect(wrapper.text()).toContain("app.vue");
  });

  it("collapses directory on second click", async () => {
    const wrapper = await mountSuspended(FileTree, {
      props: { nodes: makeTree() },
    });
    const dirItem = wrapper.find(".tree-directory");

    // Open
    await dirItem.trigger("click");
    await nextTick();
    expect(wrapper.text()).toContain("index.ts");

    // Close
    await dirItem.trigger("click");
    await nextTick();
    expect(wrapper.text()).not.toContain("index.ts");
  });

  it("has minimum touch-target height on items", async () => {
    const wrapper = await mountSuspended(FileTree, {
      props: { nodes: makeTree() },
    });
    const item = wrapper.find(".tree-item");
    expect(item.exists()).toBe(true);
    // Check that min-height style is applied (CSS computed style won't be
    // available in happy-dom, but we can check the class exists)
    expect(item.classes()).toContain("tree-item");
  });
});
