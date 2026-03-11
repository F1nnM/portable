<script setup lang="ts">
const props = defineProps<{
  filename: string;
  diff: string;
}>();

const emit = defineEmits<{
  back: [];
  viewFile: [path: string];
}>();

interface DiffLine {
  type: "added" | "removed" | "context" | "hunk-header";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

const parsedLines = computed((): DiffLine[] => {
  const lines = props.diff.split("\n");
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Skip diff header lines (--- and +++)
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    // Hunk header
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number.parseInt(match[1], 10) - 1;
        newLine = Number.parseInt(match[2], 10) - 1;
      }
      result.push({ type: "hunk-header", content: line });
      continue;
    }

    // Added line
    if (line.startsWith("+")) {
      newLine++;
      result.push({
        type: "added",
        content: line.slice(1),
        newLineNum: newLine,
      });
      continue;
    }

    // Removed line
    if (line.startsWith("-")) {
      oldLine++;
      result.push({
        type: "removed",
        content: line.slice(1),
        oldLineNum: oldLine,
      });
      continue;
    }

    // Context line (starts with space or empty)
    if (line.startsWith(" ") || line === "") {
      oldLine++;
      newLine++;
      result.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNum: oldLine,
        newLineNum: newLine,
      });
    }
  }

  return result;
});

function handleBack() {
  emit("back");
}

function handleViewFile() {
  emit("viewFile", props.filename);
}
</script>

<template>
  <div class="diff-viewer">
    <!-- Header -->
    <div class="diff-header">
      <button class="btn-back" aria-label="Back" @click="handleBack">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="12 4 6 10 12 16" />
        </svg>
      </button>

      <span class="diff-filename">{{ filename }}</span>

      <button class="btn-view-file" @click="handleViewFile">View full file</button>
    </div>

    <!-- Diff content -->
    <div class="diff-content">
      <div
        v-for="(line, idx) in parsedLines"
        :key="idx"
        class="diff-line"
        :class="{
          'diff-line-added': line.type === 'added',
          'diff-line-removed': line.type === 'removed',
          'diff-line-context': line.type === 'context',
          'diff-hunk-header': line.type === 'hunk-header',
        }"
      >
        <span v-if="line.type === 'hunk-header'" class="diff-hunk-text">{{ line.content }}</span>
        <template v-else>
          <span class="diff-gutter diff-gutter-old">{{
            line.oldLineNum != null ? line.oldLineNum : ""
          }}</span>
          <span class="diff-gutter diff-gutter-new">{{
            line.newLineNum != null ? line.newLineNum : ""
          }}</span>
          <span class="diff-sign">{{
            line.type === "added" ? "+" : line.type === "removed" ? "-" : " "
          }}</span>
          <span class="diff-text">{{ line.content }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.diff-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  min-height: var(--touch-min);
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-back:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}

.btn-back svg {
  width: 18px;
  height: 18px;
}

.diff-filename {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-view-file {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-fast);
  min-height: 32px;
}

.btn-view-file:hover {
  background: var(--color-accent-tint);
}

/* Diff content */
.diff-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.diff-line {
  display: flex;
  white-space: pre;
  min-height: 22px;
}

.diff-line-added {
  background: var(--color-success-tint);
}

.diff-line-removed {
  background: var(--color-danger-tint);
}

.diff-line-context {
  background: transparent;
}

.diff-hunk-header {
  background: var(--color-bg-inset);
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-3);
  font-style: italic;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.diff-hunk-text {
  padding: 0 var(--space-2);
}

.diff-gutter {
  display: inline-block;
  width: 48px;
  text-align: right;
  padding-right: var(--space-2);
  color: var(--color-text-muted);
  flex-shrink: 0;
  user-select: none;
}

.diff-gutter-old {
  border-right: 1px solid var(--color-border);
}

.diff-sign {
  display: inline-block;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  user-select: none;
}

.diff-line-added .diff-sign {
  color: var(--color-success);
}

.diff-line-removed .diff-sign {
  color: var(--color-danger);
}

.diff-text {
  flex: 1;
  padding-left: var(--space-1);
}
</style>
