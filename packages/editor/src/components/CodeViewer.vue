<script setup lang="ts">
import type { Extension } from "@codemirror/state";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, lineNumbers } from "@codemirror/view";
import { onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  path: string;
  content: string;
  isEditing: boolean;
}>();

const emit = defineEmits<{
  back: [];
  toggleEdit: [];
  save: [];
  contentChange: [content: string];
}>();

const editorContainer = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getLanguageExtension(path: string): Extension[] {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return [javascript()];
    case "ts":
    case "mts":
    case "cts":
      return [javascript({ typescript: true })];
    case "jsx":
      return [javascript({ jsx: true })];
    case "tsx":
      return [javascript({ typescript: true, jsx: true })];
    case "json":
      return [json()];
    case "css":
    case "scss":
      return [css()];
    case "html":
      return [html()];
    case "vue":
      return [html()];
    case "md":
    case "markdown":
      return [markdown()];
    default:
      return [];
  }
}

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-bg)",
      color: "var(--color-text)",
      height: "100%",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-bg-elevated)",
      color: "var(--color-text-muted)",
      border: "none",
      borderRight: "1px solid var(--color-border)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--color-bg-surface)",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--color-accent)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(88, 166, 255, 0.2) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(88, 166, 255, 0.3) !important",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      fontSize: "0.8125rem",
      lineHeight: "1.5",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: true },
);

function createEditor() {
  if (!editorContainer.value) return;

  // Destroy previous instance
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }

  const extensions: Extension[] = [
    lineNumbers(),
    oneDark,
    darkTheme,
    ...getLanguageExtension(props.path),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit("contentChange", update.state.doc.toString());
      }
    }),
  ];

  if (!props.isEditing) {
    extensions.push(EditorState.readOnly.of(true));
  }

  const state = EditorState.create({
    doc: props.content,
    extensions,
  });

  editorView = new EditorView({
    state,
    parent: editorContainer.value,
  });
}

onMounted(() => {
  createEditor();
});

onUnmounted(() => {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
});

watch(
  () => props.isEditing,
  () => {
    createEditor();
  },
);

watch(
  () => props.path,
  () => {
    createEditor();
  },
);
</script>

<template>
  <div class="code-viewer" data-testid="code-viewer">
    <header class="viewer-header">
      <button class="header-btn back-btn" data-testid="back-btn" @click="emit('back')">
        <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="filename">{{ getFileName(path) }}</span>
      <div class="header-actions">
        <button
          v-if="isEditing"
          class="header-btn save-btn"
          data-testid="save-btn"
          @click="emit('save')"
        >
          Save
        </button>
        <button class="header-btn edit-btn" data-testid="edit-toggle" @click="emit('toggleEdit')">
          {{ isEditing ? "Done" : "Edit" }}
        </button>
      </div>
    </header>
    <div ref="editorContainer" class="editor-container" data-testid="codemirror-container" />
  </div>
</template>

<style scoped>
.code-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.viewer-header {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 4px;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  padding: 8px 12px;
  min-height: 40px;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.header-btn:active {
  opacity: 0.7;
}

.filename {
  flex: 1;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
}

.header-actions {
  display: flex;
  align-items: center;
}

.save-btn {
  color: var(--color-accent-active);
}

.editor-container {
  flex: 1;
  overflow: hidden;
}
</style>
