<script setup lang="ts">
import type { TreeNode } from "~/types/files";
import { ref } from "vue";
import FileTree from "./FileTree.vue";

const selectedFile = ref("");

const sampleTree: TreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      {
        name: "components",
        path: "src/components",
        type: "directory",
        children: [
          { name: "Button.vue", path: "src/components/Button.vue", type: "file" },
          { name: "Header.vue", path: "src/components/Header.vue", type: "file" },
          { name: "Sidebar.vue", path: "src/components/Sidebar.vue", type: "file" },
        ],
      },
      {
        name: "pages",
        path: "src/pages",
        type: "directory",
        children: [
          { name: "index.vue", path: "src/pages/index.vue", type: "file" },
          { name: "about.vue", path: "src/pages/about.vue", type: "file" },
          { name: "settings.vue", path: "src/pages/settings.vue", type: "file" },
        ],
      },
      {
        name: "utils",
        path: "src/utils",
        type: "directory",
        children: [
          { name: "auth.ts", path: "src/utils/auth.ts", type: "file" },
          { name: "crypto.ts", path: "src/utils/crypto.ts", type: "file" },
        ],
      },
      { name: "app.vue", path: "src/app.vue", type: "file" },
      { name: "main.ts", path: "src/main.ts", type: "file" },
    ],
  },
  {
    name: "public",
    path: "public",
    type: "directory",
    children: [
      { name: "favicon.ico", path: "public/favicon.ico", type: "file" },
      { name: "robots.txt", path: "public/robots.txt", type: "file" },
    ],
  },
  { name: "nuxt.config.ts", path: "nuxt.config.ts", type: "file" },
  { name: "package.json", path: "package.json", type: "file" },
  { name: "tsconfig.json", path: "tsconfig.json", type: "file" },
  { name: ".gitignore", path: ".gitignore", type: "file" },
];

const flatTree: TreeNode[] = [
  { name: "index.html", path: "index.html", type: "file" },
  { name: "style.css", path: "style.css", type: "file" },
  { name: "main.js", path: "main.js", type: "file" },
];

function handleSelect(path: string) {
  selectedFile.value = path;
}
</script>

<template>
  <Story title="Files / FileTree" group="files">
    <Variant title="Nested Project Structure">
      <div
        style="
          width: 300px;
          height: 500px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow-y: auto;
          background: var(--color-bg-surface);
        "
      >
        <FileTree :nodes="sampleTree" @select="handleSelect" />
      </div>
      <div
        v-if="selectedFile"
        style="
          padding: var(--space-3);
          font-family: var(--font-mono);
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
        "
      >
        Selected: {{ selectedFile }}
      </div>
    </Variant>

    <Variant title="Flat Files Only">
      <div
        style="
          width: 300px;
          height: 300px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow-y: auto;
          background: var(--color-bg-surface);
        "
      >
        <FileTree :nodes="flatTree" @select="handleSelect" />
      </div>
    </Variant>

    <Variant title="Empty">
      <div
        style="
          width: 300px;
          height: 200px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow-y: auto;
          background: var(--color-bg-surface);
        "
      >
        <FileTree :nodes="[]" @select="handleSelect" />
      </div>
    </Variant>
  </Story>
</template>
