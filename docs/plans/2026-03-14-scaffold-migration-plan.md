# Scaffold Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable scaffold version tracking and migration prompts so projects can stay aligned with evolving scaffolds.

**Architecture:** A `.portable.yaml` file in each project repo tracks the scaffold version. The main app reads this file from the running pod, compares it with the deployed scaffold version, and blocks auto-redirect to chat when migration is needed. The user clicks a "Migrate" button that pre-fills a chat prompt instructing Claude to diff and apply scaffold changes.

**Tech Stack:** Nuxt 3, Vue 3, Helm, GitHub Actions, YAML

---

### Task 1: Add scaffold config to Nuxt runtimeConfig

**Files:**

- Modify: `packages/app/nuxt.config.ts:337-350`

**Step 1: Add runtimeConfig entries**

In `packages/app/nuxt.config.ts`, add two new keys to the `runtimeConfig` object (after `allowedUsers` on line 349):

```typescript
runtimeConfig: {
  githubClientId: "",
  githubClientSecret: "",
  encryptionKey: "",
  baseUrl: "http://localhost:3000",
  podNamespace: "default",
  podServerImage: "portable/pod-server:latest",
  podResourceCpuRequest: "500m",
  podResourceCpuLimit: "2000m",
  podResourceMemoryRequest: "512Mi",
  podResourceMemoryLimit: "4Gi",
  podStorageSize: "5Gi",
  allowedUsers: "",
  scaffoldVersion: "",
  scaffoldRepoUrl: "",
},
```

**Step 2: Commit**

```bash
git add packages/app/nuxt.config.ts
git commit -m "Add scaffoldVersion and scaffoldRepoUrl runtime config"
```

---

### Task 2: Add scaffold config to Helm chart

**Files:**

- Modify: `deploy/helm/portable/values.yaml:224-225` (after pod.storage)
- Modify: `deploy/helm/portable/templates/configmap.yaml`
- Modify: `deploy/dev-values.yaml`

**Step 1: Add values to values.yaml**

After `pod.storage` (line 224) and before the `podServer` section, add:

```yaml
# -- Scaffold version tracking.
# Used to detect when project scaffolds need migration to newer versions.
scaffold:
  # -- Git commit hash of the portable repo at build time.
  # Baked in by CI. In dev, computed from the local repo.
  version: ""
  # -- Public URL of the portable repo containing scaffolds.
  # Example: https://github.com/myorg/portable
  repoUrl: ""
```

**Step 2: Add to configmap.yaml**

In `deploy/helm/portable/templates/configmap.yaml`, add after the `NUXT_ALLOWED_USERS` block:

```yaml
  {{- if .Values.scaffold.version }}
  NUXT_SCAFFOLD_VERSION: {{ .Values.scaffold.version | quote }}
  {{- end }}
  {{- if .Values.scaffold.repoUrl }}
  NUXT_SCAFFOLD_REPO_URL: {{ .Values.scaffold.repoUrl | quote }}
  {{- end }}
```

**Step 3: Add dev values**

In `deploy/dev-values.yaml`, add at the end:

```yaml
# Scaffold version tracking for dev — Tiltfile overrides scaffold.version at runtime
scaffold:
  repoUrl: "https://github.com/anthropics/portable"
```

Note: `scaffold.version` is left empty here because the Tiltfile will inject the current git hash.

**Step 4: Commit**

```bash
git add deploy/helm/portable/values.yaml deploy/helm/portable/templates/configmap.yaml deploy/dev-values.yaml
git commit -m "Add scaffold version and repo URL to Helm chart config"
```

---

### Task 3: Inject scaffold version in Tiltfile

**Files:**

- Modify: `Tiltfile:83-96` (helm section)

**Step 1: Compute git hash and pass to Helm**

In the `Tiltfile`, add a `local()` call to compute the git hash, then pass it as a Helm set value. Before the `k8s_yaml(helm(...))` block (line 83), add:

```python
SCAFFOLD_VERSION = str(local("git rev-parse HEAD", quiet=True)).strip()
```

Then in the `set` list inside the `helm()` call, add:

```python
set=[
    "image.repository=" + APP_IMAGE,
    "image.tag=dev",
    "podServer.image.repository=" + POD_SERVER_IMAGE,
    "podServer.image.tag=dev",
    "scaffold.version=" + SCAFFOLD_VERSION,
],
```

**Step 2: Commit**

```bash
git add Tiltfile
git commit -m "Inject scaffold version from git hash in Tiltfile"
```

---

### Task 4: Inject scaffold version in CI release workflow

**Files:**

- Modify: `.github/workflows/release.yml:87-95` (build-app job)

**Step 1: Pass git SHA as build arg**

In the `build-app` job's "Build and push app image" step, add the `build-args` parameter:

```yaml
- name: Build and push app image
  uses: docker/build-push-action@v6
  with:
    context: .
    file: packages/app/Dockerfile
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    build-args: |
      SCAFFOLD_VERSION=${{ github.sha }}
    cache-from: type=gha,scope=app
    cache-to: type=gha,mode=max,scope=app
```

**Step 2: Add ARG and ENV to Dockerfile**

In `packages/app/Dockerfile`, in the runtime stage (after line 52 `COPY scaffolds/ scaffolds/`), add:

```dockerfile
# Scaffold version for migration detection
ARG SCAFFOLD_VERSION=""
ENV NUXT_SCAFFOLD_VERSION=${SCAFFOLD_VERSION}
```

**Step 3: Also update the Helm "Bake image refs" step**

In the `helm` job's "Bake image refs into values.yaml" step (line 168), add a sed command to set the scaffold version:

```yaml
- name: Bake image refs into values.yaml
  run: |
    TAG="${{ steps.sha.outputs.short }}"
    OWNER="${{ steps.sha.outputs.owner }}"
    SHA="${{ github.sha }}"
    sed -i "s|repository: portable/app|repository: ghcr.io/${OWNER}/portable-app|" deploy/helm/portable/values.yaml
    sed -i "s|repository: portable/pod-server|repository: ghcr.io/${OWNER}/portable-pod-server|" deploy/helm/portable/values.yaml
    sed -i "/ghcr.io\/${OWNER}\/portable-app/,/tag:/s|tag: \".*\"|tag: \"${TAG}\"|" deploy/helm/portable/values.yaml
    sed -i "/ghcr.io\/${OWNER}\/portable-pod-server/,/tag:/s|tag: \".*\"|tag: \"${TAG}\"|" deploy/helm/portable/values.yaml
    sed -i "s|version: \"\"|version: \"${SHA}\"|" deploy/helm/portable/values.yaml
```

Note: The last sed line targets the `scaffold.version` empty string. It may need to be more specific if there are other empty `version:` fields. Check the values.yaml structure — there's only one `version: ""` under `scaffold:`, so this works.

**Step 4: Commit**

```bash
git add .github/workflows/release.yml packages/app/Dockerfile
git commit -m "Inject scaffold version as build arg in CI and Dockerfile"
```

---

### Task 5: Include `.portable.yaml` in scaffold push

**Files:**

- Modify: `packages/app/server/utils/github.ts:199-253` (pushScaffoldToRepo)
- Test: `packages/app/tests/github.test.ts` (or create if not exists)

**Step 1: Write the failing test**

Create or modify a test file. The test should verify that `pushScaffoldToRepo` (or the file list it uses) includes a `.portable.yaml` file. Since `pushScaffoldToRepo` uses `readScaffoldFiles()` + adds the `.portable.yaml` dynamically, test the generation:

```typescript
import { describe, expect, it } from "vitest";
import { generatePortableYaml } from "~/server/utils/scaffold-version";

describe("generatePortableYaml", () => {
  it("generates valid YAML with scaffold metadata", () => {
    const result = generatePortableYaml({
      repoUrl: "https://github.com/user/portable",
      scaffoldPath: "scaffolds/nuxt-postgres",
      version: "abc123",
    });

    expect(result).toContain("repo: https://github.com/user/portable");
    expect(result).toContain("path: scaffolds/nuxt-postgres");
    expect(result).toContain("version: abc123");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter @portable/app test -- --run scaffold-version`
Expected: FAIL — module not found

**Step 3: Create the scaffold-version utility**

Create `packages/app/server/utils/scaffold-version.ts`:

```typescript
export interface PortableYamlConfig {
  repoUrl: string;
  scaffoldPath: string;
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
```

**Step 4: Run test to verify it passes**

Run: `bun run --filter @portable/app test -- --run scaffold-version`
Expected: PASS

**Step 5: Modify pushScaffoldToRepo to include `.portable.yaml`**

In `packages/app/server/utils/github.ts`, import the utility and modify `pushScaffoldToRepo`:

```typescript
import { generatePortableYaml } from "./scaffold-version";
```

At the top of `pushScaffoldToRepo` (line 206), after `const files = readScaffoldFiles(scaffoldId);`, add the `.portable.yaml` file:

```typescript
export async function pushScaffoldToRepo(
  token: string,
  owner: string,
  repo: string,
  scaffoldId: string,
): Promise<void> {
  const octokit = new Octokit({ auth: token });
  const files = readScaffoldFiles(scaffoldId);

  // Add .portable.yaml with scaffold version metadata
  const config = useRuntimeConfig();
  if (config.scaffoldVersion && config.scaffoldRepoUrl) {
    files.push({
      path: ".portable.yaml",
      content: generatePortableYaml({
        repoUrl: config.scaffoldRepoUrl,
        scaffoldPath: `scaffolds/${scaffoldId}`,
        version: config.scaffoldVersion,
      }),
    });
  }

  // ... rest of the function unchanged
```

**Step 6: Commit**

```bash
git add packages/app/server/utils/scaffold-version.ts packages/app/server/utils/github.ts packages/app/tests/github.test.ts
git commit -m "Generate .portable.yaml with scaffold version metadata on project creation"
```

---

### Task 6: Add scaffold version API endpoint

**Files:**

- Create: `packages/app/server/api/projects/[slug]/scaffold-version.get.ts`
- Test: Create test file for this endpoint

**Step 1: Write the failing test**

Create a test that verifies the endpoint reads `.portable.yaml` from the pod and returns parsed data:

```typescript
import { describe, expect, it, vi } from "vitest";

// Test the parsing logic extracted into a utility
import { parsePortableYaml } from "~/server/utils/scaffold-version";

describe("parsePortableYaml", () => {
  it("parses valid .portable.yaml content", () => {
    const yaml = `scaffold:\n  repo: https://github.com/user/portable\n  path: scaffolds/nuxt-postgres\n  version: abc123\n`;
    const result = parsePortableYaml(yaml);
    expect(result).toEqual({
      repo: "https://github.com/user/portable",
      path: "scaffolds/nuxt-postgres",
      version: "abc123",
    });
  });

  it("returns null for invalid YAML", () => {
    expect(parsePortableYaml("not yaml at all {{{")).toBeNull();
  });

  it("returns null for YAML missing scaffold key", () => {
    expect(parsePortableYaml("other: data\n")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter @portable/app test -- --run scaffold-version`
Expected: FAIL — parsePortableYaml not exported

**Step 3: Add parsePortableYaml to scaffold-version utility**

Add to `packages/app/server/utils/scaffold-version.ts`:

```typescript
export interface PortableYamlData {
  repo: string;
  path: string;
  version: string;
}

export function parsePortableYaml(content: string): PortableYamlData | null {
  try {
    // Simple YAML parsing for our known structure (no library needed)
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
```

**Step 4: Run test to verify it passes**

Run: `bun run --filter @portable/app test -- --run scaffold-version`
Expected: PASS

**Step 5: Create the API endpoint**

Create `packages/app/server/api/projects/[slug]/scaffold-version.get.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { projects } from "~/server/db/schema";
import { useDb } from "~/server/utils/db";
import { parsePortableYaml } from "~/server/utils/scaffold-version";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) throw createError({ statusCode: 401 });

  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, message: "Missing slug" });

  const db = useDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) throw createError({ statusCode: 404, message: "Project not found" });
  if (project.status !== "running") {
    return { needsMigration: false, reason: "not_running" };
  }

  const config = useRuntimeConfig();
  const currentVersion = config.scaffoldVersion;

  // Read .portable.yaml from the pod
  const namespace = config.podNamespace;
  const podUrl = `http://project-${slug}.${namespace}.svc.cluster.local:3000`;

  try {
    const fileContent = await $fetch<string>(`${podUrl}/api/files/.portable.yaml`, {
      responseType: "text",
    });

    const parsed = parsePortableYaml(fileContent);

    if (!parsed) {
      // File exists but is malformed
      return {
        needsMigration: true,
        reason: "malformed_file",
        scaffoldId: project.scaffoldId,
        currentVersion,
        scaffoldRepoUrl: config.scaffoldRepoUrl,
      };
    }

    if (currentVersion && parsed.version !== currentVersion) {
      return {
        needsMigration: true,
        reason: "version_mismatch",
        scaffoldId: project.scaffoldId,
        projectVersion: parsed.version,
        projectScaffoldPath: parsed.path,
        projectScaffoldRepo: parsed.repo,
        currentVersion,
        scaffoldRepoUrl: config.scaffoldRepoUrl,
      };
    }

    return { needsMigration: false };
  } catch {
    // File doesn't exist (404 from pod)
    if (project.scaffoldId) {
      // Scaffold project without .portable.yaml — old project
      return {
        needsMigration: true,
        reason: "missing_file_scaffold",
        scaffoldId: project.scaffoldId,
        currentVersion,
        scaffoldRepoUrl: config.scaffoldRepoUrl,
      };
    }

    // Imported project without .portable.yaml
    return {
      needsMigration: true,
      reason: "missing_file_imported",
      currentVersion,
      scaffoldRepoUrl: config.scaffoldRepoUrl,
    };
  }
});
```

**Step 6: Commit**

```bash
git add packages/app/server/utils/scaffold-version.ts packages/app/server/api/projects/[slug]/scaffold-version.get.ts packages/app/tests/
git commit -m "Add scaffold version API endpoint and YAML parsing"
```

---

### Task 7: Add scaffolds list API for imported project setup

The scaffolds list endpoint already exists at `GET /api/scaffolds`. No work needed for this task — the imported project setup flow can use it to show a scaffold picker. Skip this task.

---

### Task 8: Update intermediary screen with migration check

**Files:**

- Modify: `packages/app/pages/projects/[slug].vue`

**Step 1: Add migration state and check logic**

In the `<script setup>` section, add new refs and a function to check migration status. After `startActionError` (line 16), add:

```typescript
// Migration state
const migrationCheck = ref<{
  needsMigration: boolean;
  reason?: string;
  scaffoldId?: string | null;
  projectVersion?: string;
  projectScaffoldPath?: string;
  projectScaffoldRepo?: string;
  currentVersion?: string;
  scaffoldRepoUrl?: string;
} | null>(null);
const migrationChecked = ref(false);
const scaffolds = ref<{ id: string; name: string; description: string }[]>([]);
const selectedScaffoldId = ref<string | null>(null);

async function checkMigration() {
  if (!project.value || project.value.status !== "running") return;
  try {
    const data = await $fetch(`/api/projects/${slug.value}/scaffold-version`);
    migrationCheck.value = data;
    // If imported project needs setup, fetch scaffolds for the picker
    if (data.needsMigration && data.reason === "missing_file_imported") {
      const scaffoldData = await $fetch<{ scaffolds: typeof scaffolds.value }>("/api/scaffolds");
      scaffolds.value = scaffoldData.scaffolds;
      if (scaffoldData.scaffolds.length > 0) {
        selectedScaffoldId.value = scaffoldData.scaffolds[0].id;
      }
    }
  } catch {
    // If the check fails, don't block — allow through
    migrationCheck.value = { needsMigration: false };
  }
  migrationChecked.value = true;
}
```

**Step 2: Modify the auto-redirect logic**

Replace the poll status auto-redirect (line 114-118) to check migration first:

```typescript
// If the project is now running, check migration before navigating
if (data.status === "running") {
  stopPolling();
  await checkMigration();
  if (!migrationCheck.value?.needsMigration) {
    await navigateTo(`/projects/${slug.value}/chat`);
  }
}
```

Also modify the `onMounted` auto-redirect (lines 192-195):

```typescript
// If the project is running, check migration before navigating
if (project.value?.status === "running") {
  await checkMigration();
  if (!migrationCheck.value?.needsMigration) {
    await navigateTo(`/projects/${slug.value}/chat`);
  }
}
```

**Step 3: Add migration prompt builder**

Add a function that builds the pre-filled prompt and navigates to chat:

```typescript
function buildMigrationPrompt(): string {
  const m = migrationCheck.value;
  if (!m) return "";

  const repoUrl = m.scaffoldRepoUrl || m.projectScaffoldRepo || "";

  if (m.reason === "version_mismatch") {
    const scaffoldPath = m.projectScaffoldPath || `scaffolds/${m.scaffoldId}`;
    return `The scaffold this project was created from has been updated. Please migrate this project to the latest scaffold version.

1. Clone the scaffold repository to a temporary directory:
   \`git clone ${repoUrl} /tmp/scaffold-migration\`
2. The scaffold is in the \`${scaffoldPath}/\` folder. Compare the version this project was created from (commit \`${m.projectVersion}\`) with the current deployed version (commit \`${m.currentVersion}\`):
   \`cd /tmp/scaffold-migration && git diff ${m.projectVersion} ${m.currentVersion} -- ${scaffoldPath}/\`
3. Review the diff and apply the relevant changes to this project, adapting them to any customizations that have been made. Skip changes that conflict with intentional project modifications.
4. Update \`.portable.yaml\` in the project root to reflect the new version:
   \`\`\`yaml
   scaffold:
     repo: ${repoUrl}
     path: ${scaffoldPath}
     version: ${m.currentVersion}
   \`\`\`
5. After migration is complete, please tell me to stop and restart the project so the changes take effect.`;
  }

  if (m.reason === "missing_file_scaffold") {
    const scaffoldPath = `scaffolds/${m.scaffoldId}`;
    return `This project was created from a Portable scaffold but is missing its \`.portable.yaml\` version file. Please set it up for the latest scaffold version.

1. Clone the scaffold repository to a temporary directory:
   \`git clone ${repoUrl} /tmp/scaffold-migration\`
2. Read the Portable requirements from the scaffold:
   \`cat /tmp/scaffold-migration/${scaffoldPath}/CLAUDE.md\`
3. Check the current scaffold at commit \`${m.currentVersion}\` and ensure this project has all necessary configuration. Apply any missing changes.
4. Create \`.portable.yaml\` in the project root:
   \`\`\`yaml
   scaffold:
     repo: ${repoUrl}
     path: ${scaffoldPath}
     version: ${m.currentVersion}
   \`\`\`
5. After setup is complete, please tell me to stop and restart the project so the changes take effect.`;
  }

  if (m.reason === "missing_file_imported") {
    const scaffoldId = selectedScaffoldId.value || "nuxt-postgres";
    const scaffoldPath = `scaffolds/${scaffoldId}`;
    return `This project was not created from a Portable scaffold. Please configure it to work correctly in the Portable environment.

1. Clone the scaffold repository to a temporary directory:
   \`git clone ${repoUrl} /tmp/scaffold-reference\`
2. Read the Portable requirements from the scaffold's CLAUDE.md:
   \`cat /tmp/scaffold-reference/${scaffoldPath}/CLAUDE.md\`
3. Adapt this project to meet the Portable requirements described in that file. Do not overwrite the project's existing structure -- only add or modify what's needed for Portable compatibility.
4. Create \`.portable.yaml\` in the project root:
   \`\`\`yaml
   scaffold:
     repo: ${repoUrl}
     path: ${scaffoldPath}
     version: ${m.currentVersion}
   \`\`\`
5. After setup is complete, please tell me to stop and restart the project so the changes take effect.`;
  }

  return "";
}

function handleMigrate() {
  const prompt = buildMigrationPrompt();
  navigateTo(`/projects/${slug.value}/chat?migrate=${encodeURIComponent(prompt)}`);
}

function handleSkipMigration() {
  navigateTo(`/projects/${slug.value}/chat`);
}
```

**Step 4: Add migration UI to the template**

In the template, add a new block for the migration state. After the `<NuxtLayout>` block (line 205-207) and before the `<div v-else class="status-screen">` (line 210), the running state currently shows the layout. Replace the running block with migration-aware logic:

Replace line 203-207:

```html
<!-- Running: show project layout with child routes -->
<NuxtLayout v-if="project?.status === 'running'" name="project">
  <NuxtPage />
</NuxtLayout>
```

With:

```html
<!-- Running with no migration needed: show project layout -->
<NuxtLayout
  v-if="project?.status === 'running' && migrationChecked && !migrationCheck?.needsMigration"
  name="project"
>
  <NuxtPage />
</NuxtLayout>

<!-- Running but migration needed: show migration screen -->
<div
  v-else-if="project?.status === 'running' && migrationCheck?.needsMigration"
  class="status-screen"
>
  <header class="status-header">
    <NuxtLink to="/" class="status-back" aria-label="Back to dashboard">
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="12 4 6 10 12 16" />
      </svg>
    </NuxtLink>
    <NuxtLink to="/" class="status-brand">portable<span class="status-cursor">_</span></NuxtLink>
  </header>

  <div class="status-center">
    <div class="status-icon status-icon-warning">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>

    <h2 class="status-title">{{ project?.name }}</h2>

    <!-- Version mismatch or missing file on scaffold project -->
    <template
      v-if="migrationCheck?.reason === 'version_mismatch' || migrationCheck?.reason === 'missing_file_scaffold'"
    >
      <p class="status-message">
        The project scaffold has been updated. Migrate to get the latest configuration and fixes.
      </p>
      <button class="btn-primary" @click="handleMigrate">Migrate</button>
    </template>

    <!-- Imported project without .portable.yaml -->
    <template v-else-if="migrationCheck?.reason === 'missing_file_imported'">
      <p class="status-message">
        This project may not be configured for Portable. Set it up using a scaffold as reference.
      </p>
      <div v-if="scaffolds.length > 1" class="scaffold-picker">
        <label class="picker-label" for="scaffold-select">Reference scaffold:</label>
        <select id="scaffold-select" v-model="selectedScaffoldId" class="picker-select">
          <option v-for="s in scaffolds" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <button class="btn-primary" @click="handleMigrate">Set up for Portable</button>
    </template>

    <!-- Malformed file -->
    <template v-else-if="migrationCheck?.reason === 'malformed_file'">
      <p class="status-message">
        The <code>.portable.yaml</code> file is malformed. Migrate to fix it.
      </p>
      <button class="btn-primary" @click="handleMigrate">Migrate</button>
    </template>

    <button class="btn-text" @click="handleSkipMigration">Continue without migrating</button>
  </div>
</div>
```

**Step 5: Add CSS for the new elements**

In the `<style scoped>` section, add:

```css
.status-icon-warning {
  background: var(--color-warning-tint, rgba(234, 179, 8, 0.1));
  color: var(--color-warning, #d97706);
}

.btn-text {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: var(--space-2) var(--space-4);
  transition: color var(--transition-fast);
}

.btn-text:hover {
  color: var(--color-text);
}

.scaffold-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.picker-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: left;
}

.picker-select {
  width: 100%;
  padding: var(--space-3);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
}
```

**Step 6: Commit**

```bash
git add packages/app/pages/projects/[slug].vue
git commit -m "Add scaffold migration check and warning UI to intermediary screen"
```

---

### Task 9: Pre-fill chat input from migration query param

**Files:**

- Modify: `packages/app/pages/projects/[slug]/chat.vue`
- Modify: `packages/app/components/chat/ChatInput.vue`

**Step 1: Add pre-fill support to ChatInput**

In `packages/app/components/chat/ChatInput.vue`, add a `modelValue` prop and emit for two-way binding, plus an `initialValue` prop:

Replace the props and model (lines 1-11):

```typescript
const props = defineProps<{
  isStreaming: boolean;
  initialValue?: string;
}>();

const emit = defineEmits<{
  send: [content: string];
  interrupt: [];
}>();

const inputText = ref(props.initialValue || "");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
```

Add a watch for `initialValue` changes:

```typescript
watch(
  () => props.initialValue,
  (val) => {
    if (val) {
      inputText.value = val;
      nextTick(adjustHeight);
    }
  },
);
```

**Step 2: Read the migration param in chat.vue**

In `packages/app/pages/projects/[slug]/chat.vue`, after the `slug` computed (line 5), add:

```typescript
const migratePrompt = computed(() => {
  const param = route.query.migrate;
  return typeof param === "string" ? decodeURIComponent(param) : "";
});
```

**Step 3: Auto-start new session with pre-filled prompt**

In the `onMounted` hook (lines 192-199), add logic to handle the migrate param:

```typescript
onMounted(() => {
  fetchSessions();
  fetchActiveSessions();

  // If migrate param is present, start a new session with pre-filled prompt
  if (migratePrompt.value) {
    startNewSession();
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportResize);
    window.visualViewport.addEventListener("scroll", onViewportResize);
  }
});
```

**Step 4: Pass pre-fill to ChatInput**

In the template, update the ChatInput component (line 269) to pass the initial value:

```html
<ChatInput
  :is-streaming="isStreaming"
  :initial-value="migratePrompt"
  @send="sendMessage"
  @interrupt="wsInterrupt"
/>
```

**Step 5: Clear the query param after the message is sent**

In the `sendMessage` function (line 177), clear the query param after sending:

```typescript
function sendMessage(content: string) {
  wsSend(content);
  scrollToBottom();
  // Clear migrate param after sending so it doesn't persist on refresh
  if (route.query.migrate) {
    navigateTo(`/projects/${slug.value}/chat`, { replace: true });
  }
}
```

**Step 6: Commit**

```bash
git add packages/app/pages/projects/[slug]/chat.vue packages/app/components/chat/ChatInput.vue
git commit -m "Pre-fill chat input with migration prompt from query parameter"
```

---

### Task 10: Update scaffold CLAUDE.md with Portable Requirements

**Files:**

- Modify: `scaffolds/nuxt-postgres/CLAUDE.md`

**Step 1: Add Portable Requirements section**

Append the following section to the end of `scaffolds/nuxt-postgres/CLAUDE.md`:

```markdown
## Portable Requirements

This project runs inside a Portable pod (cloud dev environment).

**Preview pane:** Serves a production build, NOT a dev server. Changes are not reflected until the project is rebuilt.

- `bun run build` -- produces the production build
- `bun run preview` -- starts the preview server on `0.0.0.0:$PORT`
- After making changes, rebuild by calling the pod's rebuild API:
  `curl -X POST http://localhost:3000/api/rebuild`
  This runs `bun run build` and restarts the preview server.
- `DATABASE_URL` env var provides Postgres access

**Framework config (Nuxt-specific):**

- `devServer.host` must be `"0.0.0.0"`
- `vite.server.allowedHosts` must be `true`
```

**Step 2: Commit**

```bash
git add scaffolds/nuxt-postgres/CLAUDE.md
git commit -m "Add Portable Requirements section to scaffold CLAUDE.md"
```

---

### Task 11: Update project CLAUDE.md documentation

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Document the new config and feature**

In the "Runtime Config" table in `CLAUDE.md`, add the two new env vars:

```markdown
| `NUXT_SCAFFOLD_VERSION` | `scaffoldVersion` | Git commit hash of scaffold version in the deployed image |
| `NUXT_SCAFFOLD_REPO_URL` | `scaffoldRepoUrl` | Public URL of the portable repo containing scaffolds |
```

Add a section under "Key Design Decisions" or "Architecture Summary":

```markdown
### Scaffold Migration

Projects track their scaffold version via a `.portable.yaml` file in the repo root. When a project is opened and the deployed scaffold version differs from the project's recorded version, the intermediary screen shows a migration warning with a button that opens a new chat session with a pre-filled prompt. The prompt instructs Claude to clone the portable repo, diff the scaffold versions, and apply changes. Imported projects without `.portable.yaml` get a setup prompt instead. The `.portable.yaml` file format:

\`\`\`yaml
scaffold:
repo: https://github.com/user/portable
path: scaffolds/nuxt-postgres
version: <git-commit-hash>
\`\`\`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Document scaffold migration feature in CLAUDE.md"
```
