import { computed, ref } from "vue";

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeNode[];
}

export interface CurrentFile {
  path: string;
  content: string;
}

function buildTree(paths: string[]): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>();

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isDir = i < parts.length - 1;

      if (!nodeMap.has(currentPath)) {
        nodeMap.set(currentPath, {
          name: part,
          path: currentPath,
          isDir,
          children: isDir ? [] : undefined,
        });
      }

      // Add as child of parent
      if (i > 0) {
        const parentPath = parts.slice(0, i).join("/");
        const parent = nodeMap.get(parentPath)!;
        if (parent.children && !parent.children.some((c) => c.path === currentPath)) {
          parent.children.push(nodeMap.get(currentPath)!);
        }
      }
    }
  }

  // Collect root-level nodes
  const roots: FileTreeNode[] = [];
  for (const [, node] of nodeMap) {
    if (!node.path.includes("/")) {
      roots.push(node);
    }
  }

  // Sort recursively: dirs first, then files, alphabetical within each group
  sortTree(roots);
  return roots;
}

function sortTree(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}

// Module-level state: intentionally shared across all useFiles() callers so the
// Files view, CodeViewer, and any other consumer share a single file-browser state.
const fileTree = ref<FileTreeNode[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const currentFile = ref<CurrentFile | null>(null);
const isEditing = ref(false);

// Track the latest content in the editor (may differ from currentFile.content when edited)
const editorContent = ref<string>("");

export function useFiles() {
  async function fetchFileTree(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/files");
      if (!res.ok) {
        throw new Error(`Failed to fetch files: ${res.status}`);
      }
      const data = (await res.json()) as { files: string[] };
      fileTree.value = buildTree(data.files);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  async function fetchFileContent(path: string): Promise<string> {
    const res = await fetch(`/api/files/${path}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch file: ${res.status}`);
    }
    return res.text();
  }

  async function saveFile(path: string, content: string): Promise<void> {
    const res = await fetch(`/api/files/${path}`, {
      method: "PUT",
      body: content,
    });
    if (!res.ok) {
      throw new Error(`Failed to save file: ${res.status}`);
    }
  }

  async function openFile(path: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const content = await fetchFileContent(path);
      currentFile.value = { path, content };
      editorContent.value = content;
      isEditing.value = false;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  function closeFile(): void {
    currentFile.value = null;
    isEditing.value = false;
    editorContent.value = "";
  }

  async function saveCurrentFile(): Promise<void> {
    if (!currentFile.value) return;
    error.value = null;
    try {
      await saveFile(currentFile.value.path, editorContent.value);
      currentFile.value.content = editorContent.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to save file";
    }
  }

  function reset(): void {
    fileTree.value = [];
    loading.value = false;
    error.value = null;
    currentFile.value = null;
    isEditing.value = false;
    editorContent.value = "";
  }

  return {
    fileTree: computed(() => fileTree.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    currentFile: computed(() => currentFile.value),
    isEditing,
    editorContent,
    fetchFileTree,
    fetchFileContent,
    saveFile,
    openFile,
    closeFile,
    saveCurrentFile,
    reset,
  };
}
