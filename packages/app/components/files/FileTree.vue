<script setup lang="ts">
import type { TreeNode } from "~/types/files";
import { getIcon } from "material-file-icons";

const props = withDefaults(
  defineProps<{
    nodes: TreeNode[];
    depth?: number;
  }>(),
  { depth: 0 },
);

const emit = defineEmits<{
  select: [path: string];
}>();

const expandedDirs = ref<string[]>([]);

// Sort: directories first (alphabetical), then files (alphabetical)
const sortedNodes = computed(() =>
  [...props.nodes].sort((a, b) => {
    if (a.type === "directory" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "directory") return 1;
    return a.name.localeCompare(b.name);
  }),
);

function toggleDir(path: string) {
  const idx = expandedDirs.value.indexOf(path);
  if (idx >= 0) {
    expandedDirs.value.splice(idx, 1);
  } else {
    expandedDirs.value.push(path);
  }
}

function isExpanded(path: string): boolean {
  return expandedDirs.value.includes(path);
}

function selectFile(path: string) {
  emit("select", path);
}

function getFileExtension(name: string): string {
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) return "";
  return name.slice(dotIdx);
}

function getFileName(name: string): string {
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) return name;
  return name.slice(0, dotIdx);
}

function getFileIconSvg(name: string): string {
  return getIcon(name).svg;
}
</script>

<template>
  <div class="file-tree" :class="{ 'tree-root': depth === 0 }">
    <template v-for="node in sortedNodes" :key="node.path">
      <!-- Directory item -->
      <div
        v-if="node.type === 'directory'"
        class="tree-item tree-item-row tree-directory"
        :style="{ paddingLeft: `${depth * 16 + 8}px` }"
        @click="toggleDir(node.path)"
      >
        <!-- Indent guides -->
        <span
          v-for="i in depth"
          :key="i"
          class="indent-guide"
          :style="{ left: `${(i - 1) * 16 + 14}px` }"
        />

        <svg
          class="tree-chevron"
          :class="{ expanded: isExpanded(node.path) }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clip-rule="evenodd"
          />
        </svg>

        <svg class="tree-icon tree-icon-dir" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
        </svg>

        <span class="tree-name">{{ node.name }}</span>
      </div>

      <!-- Directory children -->
      <div v-if="node.type === 'directory' && isExpanded(node.path) && node.children">
        <FileTree
          :nodes="node.children"
          :depth="depth + 1"
          @select="(path: string) => emit('select', path)"
        />
      </div>

      <!-- File item -->
      <div
        v-if="node.type === 'file'"
        class="tree-item tree-item-row tree-file"
        :style="{ paddingLeft: `${depth * 16 + 28}px` }"
        @click="selectFile(node.path)"
      >
        <!-- Indent guides -->
        <span
          v-for="i in depth"
          :key="i"
          class="indent-guide"
          :style="{ left: `${(i - 1) * 16 + 14}px` }"
        />

        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="tree-icon tree-icon-file" v-html="getFileIconSvg(node.name)" />

        <span class="tree-name">
          {{ getFileName(node.name)
          }}<span class="tree-ext" :class="`tree-ext-${getFileExtension(node.name).slice(1)}`">{{
            getFileExtension(node.name)
          }}</span>
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.file-tree {
  user-select: none;
}

.tree-root {
  padding: var(--space-1) 0;
}

.tree-item-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding-right: var(--space-4);
  cursor: pointer;
  position: relative;
  transition: background var(--transition-fast);
}

.tree-item-row:hover {
  background: var(--color-bg-inset);
}

.tree-item-row:active {
  background: var(--color-accent-tint);
}

/* Indent guides */
.indent-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-border);
  opacity: 0.6;
}

/* Chevron */
.tree-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.tree-chevron.expanded {
  transform: rotate(90deg);
}

/* Icons */
.tree-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tree-icon-dir {
  color: var(--color-accent);
}

.tree-icon-file {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tree-icon-file :deep(svg) {
  width: 100%;
  height: 100%;
}

/* Names */
.tree-name {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--line-height-tight);
}

.tree-directory .tree-name {
  font-weight: var(--font-weight-medium);
}

.tree-ext {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
}
</style>
