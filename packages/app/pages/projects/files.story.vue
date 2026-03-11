<script setup lang="ts">
import CodeViewer from "~/components/files/CodeViewer.vue";
import FileTree from "~/components/files/FileTree.vue";

const sampleTree = [
  {
    name: "src",
    path: "src",
    type: "directory" as const,
    children: [
      {
        name: "components",
        path: "src/components",
        type: "directory" as const,
        children: [
          { name: "Header.vue", path: "src/components/Header.vue", type: "file" as const },
          { name: "Footer.vue", path: "src/components/Footer.vue", type: "file" as const },
        ],
      },
      { name: "app.vue", path: "src/app.vue", type: "file" as const },
      { name: "main.ts", path: "src/main.ts", type: "file" as const },
    ],
  },
  { name: "package.json", path: "package.json", type: "file" as const },
  { name: "nuxt.config.ts", path: "nuxt.config.ts", type: "file" as const },
  { name: "tsconfig.json", path: "tsconfig.json", type: "file" as const },
];

const sampleCode = `import { defineConfig } from "nuxt/config";

export default defineConfig({
  devtools: { enabled: true },

  modules: [
    "@nuxtjs/tailwindcss",
    "@pinia/nuxt",
  ],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    public: {
      apiBase: "/api",
    },
  },

  compatibilityDate: "2025-01-01",
});`;
</script>

<template>
  <Story title="Pages / Project Files" group="pages">
    <Variant title="File Tree">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="files-page">
          <div class="tree-container">
            <FileTree :nodes="sampleTree" />
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Code Viewer">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="files-page">
          <CodeViewer filename="nuxt.config.ts" :content="sampleCode" :read-only="true" />
        </div>
      </div>
    </Variant>

    <Variant title="Save Toast - Success">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="files-page">
          <CodeViewer filename="nuxt.config.ts" :content="sampleCode" :read-only="false" />
          <div class="save-toast save-toast-success">File saved</div>
        </div>
      </div>
    </Variant>

    <Variant title="Empty State">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="files-page">
          <div class="empty-state">
            <p>No files found in workspace.</p>
            <button class="btn-retry">Refresh</button>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.files-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
  position: relative;
}

.tree-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.btn-retry {
  padding: var(--space-2) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  min-height: var(--touch-min);
  transition: all var(--transition-fast);
}

.btn-retry:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.save-toast {
  position: absolute;
  bottom: var(--space-5);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  z-index: 100;
  box-shadow: var(--shadow-elevated);
}

.save-toast-success {
  background: var(--color-success);
  color: #ffffff;
}
</style>
