<script setup lang="ts">
import type { FileTreeNode } from "../composables/useFiles";
import { ref } from "vue";

defineProps<{
  nodes: FileTreeNode[];
  depth?: number;
}>();

const emit = defineEmits<{
  select: [path: string];
}>();

const expandedDirs = ref<Set<string>>(new Set());

function toggleDir(path: string) {
  if (expandedDirs.value.has(path)) {
    expandedDirs.value.delete(path);
  } else {
    expandedDirs.value.add(path);
  }
}

function handleClick(node: FileTreeNode) {
  if (node.isDir) {
    toggleDir(node.path);
  } else {
    emit("select", node.path);
  }
}

function isExpanded(path: string): boolean {
  return expandedDirs.value.has(path);
}

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0) return "";
  return name.slice(dotIndex);
}

function getBaseName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0) return name;
  return name.slice(0, dotIndex);
}
</script>

<template>
  <div
    class="file-tree"
    :data-testid="depth === 0 || depth === undefined ? 'file-tree' : undefined"
  >
    <div v-for="node in nodes" :key="node.path" class="tree-node">
      <div
        class="tree-item"
        data-testid="file-tree-item"
        :style="{ paddingLeft: `${(depth ?? 0) * 16 + 8}px` }"
        @click="handleClick(node)"
      >
        <span v-if="depth" class="indent-guide" :style="{ left: `${(depth ?? 0) * 16 - 4}px` }" />
        <!-- Directory icon -->
        <svg v-if="node.isDir" class="node-icon" viewBox="0 0 16 16" fill="none">
          <path
            v-if="isExpanded(node.path)"
            d="M1.5 4.5v8a1 1 0 001 1h11a1 1 0 001-1v-6a1 1 0 00-1-1h-5l-1.5-1.5h-4.5a1 1 0 00-1 1z"
            fill="var(--color-accent)"
            opacity="0.7"
          />
          <path
            v-else
            d="M1.5 4.5v8a1 1 0 001 1h11a1 1 0 001-1v-6a1 1 0 00-1-1h-5l-1.5-1.5h-4.5a1 1 0 00-1 1z"
            fill="var(--color-text-muted)"
            opacity="0.6"
          />
        </svg>
        <!-- File icon -->
        <svg v-else class="node-icon" viewBox="0 0 16 16" fill="none">
          <path
            d="M4.5 1.5h5l3 3v9a1 1 0 01-1 1h-7a1 1 0 01-1-1v-11a1 1 0 011-1z"
            stroke="var(--color-text-muted)"
            stroke-width="1"
            fill="none"
            opacity="0.6"
          />
        </svg>
        <span class="node-name">
          <span class="name-base">{{ node.isDir ? node.name : getBaseName(node.name) }}</span>
          <span v-if="!node.isDir && getExtension(node.name)" class="name-ext">{{
            getExtension(node.name)
          }}</span>
        </span>
        <!-- Expand indicator for dirs -->
        <svg
          v-if="node.isDir"
          class="expand-icon"
          :class="{ expanded: isExpanded(node.path) }"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <!-- Recursive children -->
      <FileTree
        v-if="node.isDir && node.children && isExpanded(node.path)"
        :nodes="node.children"
        :depth="(depth ?? 0) + 1"
        @select="(path: string) => emit('select', path)"
      />
    </div>
  </div>
</template>

<style scoped>
.file-tree {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding-right: 12px;
  cursor: pointer;
  position: relative;
  color: var(--color-text);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.tree-item:active {
  background: var(--color-bg-surface);
}

.indent-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-border);
}

.node-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-ext {
  color: var(--color-text-muted);
}

.expand-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.15s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}
</style>
