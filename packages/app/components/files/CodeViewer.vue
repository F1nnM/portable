<script setup lang="ts">
import type { Extension } from "@codemirror/state";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const props = defineProps<{
  filename: string;
  content: string;
  readOnly: boolean;
}>();

const emit = defineEmits<{
  back: [];
  save: [content: string];
  toggleEdit: [];
}>();

const editorContainer = ref<HTMLElement | null>(null);
const editorView = ref<EditorView | null>(null);
const readonlyCompartment = new Compartment();

// Warm-toned theme matching the design tokens
const warmTheme = EditorView.theme(
  {
    "&": {
      color: "var(--color-text)",
      backgroundColor: "var(--color-bg-surface)",
      fontSize: "var(--font-size-sm)",
      fontFamily: "var(--font-mono)",
    },
    ".cm-content": {
      caretColor: "var(--color-accent)",
      lineHeight: "1.6",
      padding: "var(--space-3) 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-accent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--color-accent-tint)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-bg)",
      color: "var(--color-text-muted)",
      border: "none",
      borderRight: "1px solid var(--color-border)",
      padding: "0 var(--space-2)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-text-secondary)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--color-bg-inset)",
    },
    ".cm-line": {
      padding: "0 var(--space-3)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--color-bg-inset)",
      border: "none",
      color: "var(--color-text-muted)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: false },
);

const warmHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#b854a4" },
  { tag: tags.operator, color: "#b854a4" },
  { tag: tags.special(tags.variableName), color: "#c46a2e" },
  { tag: tags.typeName, color: "#2d8fa0" },
  { tag: tags.atom, color: "#c46a2e" },
  { tag: tags.number, color: "#c46a2e" },
  { tag: tags.definition(tags.variableName), color: "#3a8f5c" },
  { tag: tags.string, color: "#3a8f5c" },
  { tag: tags.special(tags.string), color: "#3a8f5c" },
  { tag: tags.comment, color: "var(--color-text-muted)", fontStyle: "italic" },
  { tag: tags.variableName, color: "var(--color-text)" },
  { tag: tags.bracket, color: "var(--color-text-secondary)" },
  { tag: tags.tagName, color: "#c46a2e" },
  { tag: tags.attributeName, color: "#2d8fa0" },
  { tag: tags.attributeValue, color: "#3a8f5c" },
  { tag: tags.propertyName, color: "#c46a2e" },
  { tag: tags.function(tags.variableName), color: "#2d8fa0" },
  { tag: tags.bool, color: "#c46a2e" },
  { tag: tags.null, color: "#c46a2e" },
  { tag: tags.className, color: "#2d8fa0" },
  { tag: tags.regexp, color: "#d97a3e" },
  { tag: tags.meta, color: "var(--color-text-muted)" },
  { tag: tags.heading, color: "#c46a2e", fontWeight: "bold" },
  { tag: tags.link, color: "#2d8fa0", textDecoration: "underline" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
]);

function getLanguageExtension(filename: string): Extension | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return javascript();
    case "ts":
    case "mts":
    case "cts":
      return javascript({ typescript: true });
    case "jsx":
      return javascript({ jsx: true });
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "json":
      return json();
    case "css":
      return css();
    case "scss":
      return css();
    case "html":
    case "vue":
      return html();
    case "md":
    case "markdown":
      return markdown();
    default:
      return null;
  }
}

function getCurrentContent(): string {
  return editorView.value?.state.doc.toString() ?? props.content;
}

function handleSave() {
  emit("save", getCurrentContent());
}

function handleBack() {
  emit("back");
}

function handleToggleEdit() {
  emit("toggleEdit");
}

onMounted(() => {
  if (!editorContainer.value) return;

  const extensions: Extension[] = [
    lineNumbers(),
    warmTheme,
    syntaxHighlighting(warmHighlightStyle),
    readonlyCompartment.of(EditorState.readOnly.of(props.readOnly)),
    EditorView.lineWrapping,
    keymap.of([
      {
        key: "Mod-s",
        run: () => {
          if (!props.readOnly) {
            handleSave();
          }
          return true;
        },
      },
    ]),
  ];

  const lang = getLanguageExtension(props.filename);
  if (lang) {
    extensions.push(lang);
  }

  const state = EditorState.create({
    doc: props.content,
    extensions,
  });

  editorView.value = new EditorView({
    state,
    parent: editorContainer.value,
  });
});

// Update readonly state when prop changes
watch(
  () => props.readOnly,
  (readonly) => {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(readonly)),
      });
    }
  },
);

// Update content when prop changes
watch(
  () => props.content,
  (newContent) => {
    if (editorView.value && newContent !== editorView.value.state.doc.toString()) {
      editorView.value.dispatch({
        changes: {
          from: 0,
          to: editorView.value.state.doc.length,
          insert: newContent,
        },
      });
    }
  },
);

onUnmounted(() => {
  editorView.value?.destroy();
});
</script>

<template>
  <div class="code-viewer">
    <!-- Header -->
    <div class="viewer-header">
      <button class="btn-back" aria-label="Back to file tree" @click="handleBack">
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

      <span class="viewer-filename">{{ filename }}</span>

      <div class="viewer-actions">
        <button
          v-if="readOnly"
          class="btn-edit"
          aria-label="Toggle edit mode"
          @click="handleToggleEdit"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        <button v-else class="btn-save" aria-label="Save file" @click="handleSave">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div ref="editorContainer" class="editor-container" />
  </div>
</template>

<style scoped>
.code-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.viewer-header {
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
  background: none;
  border: none;
  padding: 0;
}

.btn-back:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}

.btn-back svg {
  width: 18px;
  height: 18px;
}

.viewer-filename {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viewer-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.btn-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: none;
  border: none;
  padding: 0;
}

.btn-edit:hover {
  color: var(--color-accent);
  background: var(--color-accent-tint);
}

.btn-edit svg {
  width: 18px;
  height: 18px;
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  height: 36px;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: none;
}

.btn-save:hover {
  background: var(--color-accent-hover);
}

.btn-save svg {
  width: 16px;
  height: 16px;
}

/* Editor container */
.editor-container {
  flex: 1;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
}

.editor-container :deep(.cm-scroller) {
  -webkit-overflow-scrolling: touch;
}
</style>
