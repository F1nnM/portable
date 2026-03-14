export interface PortableYamlConfig {
  repoUrl: string;
  scaffoldPath: string;
  version: string;
}

export interface PortableYamlData {
  repo: string;
  path: string;
  version: string;
}

export function generatePortableYaml(config: PortableYamlConfig): string {
  return [
    "scaffold:",
    `  repo: ${config.repoUrl}`,
    `  path: ${config.scaffoldPath}`,
    `  version: ${config.version}`,
    "",
  ].join("\n");
}

export function parsePortableYaml(content: string): PortableYamlData | null {
  try {
    const lines = content.split("\n");
    const data: Record<string, string> = {};
    for (const line of lines) {
      const match = line.match(/^\s+(repo|path|version):\s*(.+)$/);
      if (match) {
        data[match[1]] = match[2].trim();
      }
    }
    if (data.repo && data.path && data.version) {
      return { repo: data.repo, path: data.path, version: data.version };
    }
    return null;
  } catch {
    return null;
  }
}
