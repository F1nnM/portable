<script setup lang="ts">
import { onMounted } from "vue";
import CodeViewer from "../components/CodeViewer.vue";
import FileTree from "../components/FileTree.vue";
import { useFiles } from "../composables/useFiles";

const {
  fileTree,
  loading,
  error,
  currentFile,
  isEditing,
  editorContent,
  fetchFileTree,
  openFile,
  closeFile,
  saveCurrentFile,
} = useFiles();

onMounted(() => {
  fetchFileTree();
});

function handleSelect(path: string) {
  openFile(path);
}

function handleBack() {
  closeFile();
}

function handleToggleEdit() {
  isEditing.value = !isEditing.value;
}

async function handleSave() {
  await saveCurrentFile();
}

function handleContentChange(content: string) {
  editorContent.value = content;
}
</script>

<template>
  <div class="view files-view" data-testid="files-view">
    <!-- Loading state -->
    <div v-if="loading && !currentFile && fileTree.length === 0" class="state-message">
      <span class="state-text">Loading...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error && !currentFile && fileTree.length === 0" class="state-message">
      <span class="state-text error-text">{{ error }}</span>
    </div>

    <!-- Code viewer when a file is selected -->
    <CodeViewer
      v-else-if="currentFile"
      :path="currentFile.path"
      :content="currentFile.content"
      :is-editing="isEditing"
      @back="handleBack"
      @toggle-edit="handleToggleEdit"
      @save="handleSave"
      @content-change="handleContentChange"
    />

    <!-- File tree when no file is selected -->
    <FileTree v-else :nodes="fileTree" :depth="0" @select="handleSelect" />
  </div>
</template>

<style scoped>
.view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.files-view {
  background: var(--color-bg);
}

.state-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.state-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.error-text {
  color: #f85149;
}
</style>
