<script setup lang="ts">
import type { TreeNode } from "~/types/files";

const route = useRoute();
const slug = computed(() => route.params.slug as string);

// State: file tree vs code viewer
const selectedFile = ref<string | null>(null);
const fileContent = ref("");
const isEditing = ref(false);
const loading = ref(true);
const saving = ref(false);
const saveError = ref("");
const saveSuccess = ref(false);
const treeNodes = ref<TreeNode[]>([]);

// Build the proxy base URL for pod API calls
function podApiUrl(path: string): string {
  return `/api/projects/${slug.value}/pod${path}`;
}

// Build tree from flat file list
function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      const existing = current.find((n) => n.name === name);
      if (existing && existing.type === "directory") {
        current = existing.children!;
      } else if (!existing) {
        const node: TreeNode = {
          name,
          path: currentPath,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };
        current.push(node);
        if (!isFile) {
          current = node.children!;
        }
      }
    }
  }

  return root;
}

// Fetch file list
async function fetchFiles() {
  loading.value = true;
  try {
    const data = await $fetch<{ files: string[] }>(podApiUrl("/api/files"));
    treeNodes.value = buildTree(data.files);
  } catch {
    treeNodes.value = [];
  } finally {
    loading.value = false;
  }
}

// Read file content
async function readFile(path: string) {
  selectedFile.value = path;
  fileContent.value = "";
  isEditing.value = false;
  saveError.value = "";
  saveSuccess.value = false;

  try {
    const content = await $fetch<string>(podApiUrl(`/api/files/${encodeURIComponent(path)}`), {
      responseType: "text",
    });
    fileContent.value = content;
  } catch {
    fileContent.value = "// Failed to load file";
  }
}

// Save file
async function saveFile(content: string) {
  if (!selectedFile.value) return;
  saving.value = true;
  saveError.value = "";
  saveSuccess.value = false;

  try {
    await $fetch(podApiUrl(`/api/files/${encodeURIComponent(selectedFile.value)}`), {
      method: "PUT",
      body: content,
    });
    fileContent.value = content;
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2000);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save";
    saveError.value = msg;
  } finally {
    saving.value = false;
  }
}

function toggleEdit() {
  isEditing.value = !isEditing.value;
}

function goBackToTree() {
  selectedFile.value = null;
  fileContent.value = "";
  isEditing.value = false;
}

onMounted(fetchFiles);
</script>

<template>
  <div class="files-page">
    <!-- File tree view -->
    <template v-if="!selectedFile">
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner" />
      </div>
      <div v-else-if="treeNodes.length === 0" class="empty-state">
        <p>No files found in workspace.</p>
        <button class="btn-retry" @click="fetchFiles">Refresh</button>
      </div>
      <div v-else class="tree-container">
        <FilesFileTree :nodes="treeNodes" @select="readFile" />
      </div>
    </template>

    <!-- Code viewer -->
    <template v-else>
      <FilesCodeViewer
        :filename="selectedFile"
        :content="fileContent"
        :read-only="!isEditing"
        @back="goBackToTree"
        @save="saveFile"
        @toggle-edit="toggleEdit"
      />

      <!-- Save feedback -->
      <div v-if="saveSuccess" class="save-toast save-toast-success">File saved</div>
      <div v-if="saveError" class="save-toast save-toast-error">{{ saveError }}</div>
      <div v-if="saving" class="save-toast save-toast-saving">Saving...</div>
    </template>
  </div>
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

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-4);
  color: var(--color-text-muted);
}

.btn-retry {
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  min-height: var(--touch-min);
}

.tree-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Save feedback toast */
.save-toast {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  z-index: 100;
  animation: fadeIn 150ms ease;
}

.save-toast-success {
  background: var(--color-success-tint);
  color: var(--color-success);
}

.save-toast-error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.save-toast-saving {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
