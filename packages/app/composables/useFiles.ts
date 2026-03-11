export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

function buildTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: isLast ? undefined : [],
        };
        current.push(existing);
      } else if (!isLast && !existing.children) {
        // Promote to directory if it was a file before
        existing.isDirectory = true;
        existing.children = [];
      }

      if (!isLast && existing.children) {
        current = existing.children;
      }
    }
  }

  // Sort: directories first, then alphabetical
  sortTree(root);
  return root;
}

function sortTree(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}

export function useFiles(slug: string) {
  const files = ref<string[]>([]);
  const tree = ref<FileTreeNode[]>([]);

  async function fetchFiles(): Promise<void> {
    try {
      const data = await $fetch<{ files: string[] }>(`/api/projects/${slug}/pod/api/files`);
      files.value = data.files;
      tree.value = buildTree(data.files);
    } catch {
      // Leave unchanged on error
    }
  }

  async function readFile(path: string): Promise<string> {
    return await $fetch<string>(`/api/projects/${slug}/pod/api/files/${path}`, {
      responseType: "text",
    });
  }

  async function writeFile(path: string, content: string): Promise<void> {
    await $fetch(`/api/projects/${slug}/pod/api/files/${path}`, {
      method: "PUT",
      body: content,
    });
  }

  return {
    files,
    tree,
    fetchFiles,
    readFile,
    writeFile,
  };
}
