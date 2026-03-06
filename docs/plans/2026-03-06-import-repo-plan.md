# Import Existing GitHub Repo -- Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to import an existing GitHub repo as a Portable project, instead of creating from a scaffold.

**Architecture:** Add a `GET /api/github/repos` endpoint to list the user's GitHub repos via Octokit. Modify `POST /api/projects` to accept `{ name, repoUrl }` as an alternative to `{ name, scaffoldId }`. Make `scaffoldId` nullable in the schema. For imports, `createProject()` only creates the per-project database (skips GitHub repo creation and scaffold push). The pod server already clones from `GITHUB_REPO_URL`, so no pod-server changes needed. The `/new` page gets tabs for "From Scaffold" and "Import Repo".

**Tech Stack:** Nuxt 3, Drizzle ORM, Octokit, Vue 3, Vitest

**Design doc:** `docs/plans/2026-03-06-import-repo-design.md`

---

## Phase 1: Backend

### Task 1: Make `scaffoldId` nullable in the schema

**Files:**

- Modify: `packages/app/server/db/schema.ts:34`
- Modify: `packages/app/types/project.ts:5`
- Test: `packages/app/tests/db/schema.test.ts`

**Step 1: Write the failing test**

Add a test to `packages/app/tests/db/schema.test.ts` that asserts `scaffoldId` is nullable:

```typescript
it("allows scaffoldId to be null", async () => {
  const { projects } = await import("../../server/db/schema");
  // Drizzle column config: notNull should NOT be set
  expect(projects.scaffoldId.notNull).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/app && bun run test -- tests/db/schema.test.ts`
Expected: FAIL -- `scaffoldId.notNull` is `true` because the column currently has `.notNull()`

**Step 3: Write minimal implementation**

In `packages/app/server/db/schema.ts:34`, change:

```typescript
scaffoldId: text("scaffold_id").notNull().default("nuxt-postgres"),
```

to:

```typescript
scaffoldId: text("scaffold_id"),
```

In `packages/app/types/project.ts:5`, change:

```typescript
scaffoldId: string;
```

to:

```typescript
scaffoldId: string | null;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/app && bun run test -- tests/db/schema.test.ts`
Expected: PASS

**Step 5: Generate the Drizzle migration**

Run: `cd packages/app && bun run db:generate`

This creates a new migration file in `server/db/migrations/` that alters `scaffold_id` to drop the NOT NULL constraint and default.

**Step 6: Commit**

```bash
git add packages/app/server/db/schema.ts packages/app/types/project.ts packages/app/server/db/migrations/ packages/app/tests/db/schema.test.ts
git commit -m "Make scaffoldId nullable to support imported repos"
```

---

### Task 2: Add `GET /api/github/repos` endpoint

**Files:**

- Create: `packages/app/server/api/github/repos.get.ts`
- Modify: `packages/app/server/utils/github.ts` (add `listUserRepos` function)
- Test: `packages/app/tests/github/repos.test.ts`

**Step 1: Write the failing test**

Create `packages/app/tests/github/repos.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Octokit
const mockListForAuthenticatedUser = vi.fn();
vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        listForAuthenticatedUser: mockListForAuthenticatedUser,
      },
    },
  })),
}));

const { listUserRepos } = await import("../../server/utils/github");

describe("listUserRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns repos with expected shape", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          name: "my-repo",
          full_name: "user/my-repo",
          description: "A cool repo",
          private: false,
          language: "TypeScript",
          default_branch: "main",
          html_url: "https://github.com/user/my-repo",
        },
      ],
    });

    const repos = await listUserRepos("ghp_test_token");

    expect(repos).toEqual([
      {
        name: "my-repo",
        fullName: "user/my-repo",
        description: "A cool repo",
        isPrivate: false,
        language: "TypeScript",
        defaultBranch: "main",
        url: "https://github.com/user/my-repo",
      },
    ]);
  });

  it("passes search query as q parameter when provided", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await listUserRepos("ghp_test_token");

    expect(mockListForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        per_page: 100,
        sort: "updated",
      }),
    );
  });

  it("handles null description and language", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          name: "empty-repo",
          full_name: "user/empty-repo",
          description: null,
          private: true,
          language: null,
          default_branch: "main",
          html_url: "https://github.com/user/empty-repo",
        },
      ],
    });

    const repos = await listUserRepos("ghp_test_token");

    expect(repos[0].description).toBeNull();
    expect(repos[0].language).toBeNull();
    expect(repos[0].isPrivate).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/app && bun run test -- tests/github/repos.test.ts`
Expected: FAIL -- `listUserRepos` does not exist

**Step 3: Write minimal implementation**

Add to `packages/app/server/utils/github.ts` (at the end of the file, before closing):

```typescript
export interface UserRepo {
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
  url: string;
}

/**
 * Lists the authenticated user's GitHub repositories.
 */
export async function listUserRepos(token: string): Promise<UserRepo[]> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
  });

  return data.map((repo) => ({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? null,
    isPrivate: repo.private,
    language: repo.language ?? null,
    defaultBranch: repo.default_branch,
    url: repo.html_url,
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/app && bun run test -- tests/github/repos.test.ts`
Expected: PASS

**Step 5: Create the API endpoint**

Create `packages/app/server/api/github/repos.get.ts`:

```typescript
import { getDecryptedGithubToken, listUserRepos } from "../../utils/github";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : undefined;

  const githubToken = await getDecryptedGithubToken(user.id);
  let repos = await listUserRepos(githubToken);

  if (search) {
    const lower = search.toLowerCase();
    repos = repos.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.fullName.toLowerCase().includes(lower) ||
        (r.description && r.description.toLowerCase().includes(lower)),
    );
  }

  return { repos };
});
```

**Step 6: Run all tests to verify nothing broke**

Run: `cd packages/app && bun run test`
Expected: All pass

**Step 7: Commit**

```bash
git add packages/app/server/utils/github.ts packages/app/server/api/github/repos.get.ts packages/app/tests/github/repos.test.ts
git commit -m "Add GET /api/github/repos endpoint for listing user repos"
```

---

### Task 3: Modify `POST /api/projects` to accept `repoUrl`

**Files:**

- Modify: `packages/app/server/api/projects/index.post.ts`
- Modify: `packages/app/server/utils/project-lifecycle.ts:146-183`
- Test: `packages/app/tests/k8s/lifecycle.test.ts`

**Step 1: Write the failing test for `createProject` with import flow**

Add to the `describe("createProject", ...)` block in `packages/app/tests/k8s/lifecycle.test.ts`:

```typescript
it("skips GitHub repo creation and scaffold push for import (no scaffoldId)", async () => {
  mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-import");
  mockDb.update.mockReturnValue(makeUpdateChain());

  await createProject(TEST_USER_ID, "project-uuid-789", "my-import", null);

  expect(mockCreateProjectDatabase).toHaveBeenCalledWith("my-import");
  expect(mockGetDecryptedGithubToken).not.toHaveBeenCalled();
  expect(mockCreateGitHubRepo).not.toHaveBeenCalled();
  expect(mockPushScaffoldToRepo).not.toHaveBeenCalled();
  expect(mockClearCreationPhase).toHaveBeenCalledWith("my-import");
});

it("only tracks creating_database phase for import", async () => {
  mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-import");
  mockDb.update.mockReturnValue(makeUpdateChain());

  await createProject(TEST_USER_ID, "project-uuid-789", "my-import", null);

  expect(mockSetCreationPhase).toHaveBeenCalledWith("my-import", "creating_database");
  expect(mockSetCreationPhase).not.toHaveBeenCalledWith("my-import", "creating_repository");
  expect(mockSetCreationPhase).not.toHaveBeenCalledWith("my-import", "pushing_scaffold");
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/app && bun run test -- tests/k8s/lifecycle.test.ts`
Expected: FAIL -- `createProject` requires a non-null `scaffoldId` parameter (it's typed as `string`)

**Step 3: Modify `createProject` in project-lifecycle.ts**

Change the signature at line 146 from:

```typescript
export async function createProject(
  userId: string,
  projectId: string,
  slug: string,
  scaffoldId: string,
): Promise<void> {
```

to:

```typescript
export async function createProject(
  userId: string,
  projectId: string,
  slug: string,
  scaffoldId: string | null,
): Promise<void> {
```

Then wrap the GitHub repo / scaffold push logic (lines 156-175) in a conditional:

```typescript
try {
  setCreationPhase(slug, "creating_database");
  await createProjectDatabase(slug);

  if (scaffoldId) {
    setCreationPhase(slug, "creating_repository");
    const githubToken = await getDecryptedGithubToken(userId);
    const repo = await createGitHubRepo(githubToken, slug);

    // Persist repo URL immediately so deleteProject can clean it up on failure
    const db = useDb();
    await db
      .update(projects)
      .set({ repoUrl: repo.htmlUrl, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    setCreationPhase(slug, "pushing_scaffold");
    await pushScaffoldToRepo(githubToken, repo.owner, repo.repo, scaffoldId);

    // Mark creation complete
    await db
      .update(projects)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  } else {
    // Import flow: repoUrl is already set on the project row, just mark as stopped
    const db = useDb();
    await db
      .update(projects)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  clearCreationPhase(slug);
} catch (err: unknown) {
  await updateProjectStatus(projectId, "error").catch(() => {});
  clearCreationPhase(slug);
  throw err;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/app && bun run test -- tests/k8s/lifecycle.test.ts`
Expected: PASS

**Step 5: Write the failing test for the POST endpoint import flow**

Add to `packages/app/tests/projects/crud.test.ts` inside the `describe("unauthenticated requests", ...)` block:

```typescript
it("returns 401 for POST /api/projects with repoUrl when not authenticated", async () => {
  const response = await fetch(url("/api/projects"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Import", repoUrl: "https://github.com/user/repo" }),
  });
  expect(response.status).toBe(401);
});
```

**Step 6: Run test to verify it passes (auth tests pass without code changes)**

Run: `cd packages/app && bun run test -- tests/projects/crud.test.ts`
Expected: PASS (401 is returned before body validation)

**Step 7: Modify `POST /api/projects` endpoint**

Replace the full content of `packages/app/server/api/projects/index.post.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";
import { listScaffolds } from "../../utils/github";
import { createProject } from "../../utils/project-lifecycle";
import { generateSlug } from "../../utils/slug";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ name?: string; scaffoldId?: string; repoUrl?: string }>(event);

  if (!body?.name || body.name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Name is required" });
  }

  const name = body.name.trim();

  if (name.length > 100) {
    throw createError({ statusCode: 400, statusMessage: "Name must be 100 characters or fewer" });
  }

  const slug = generateSlug(name);

  if (slug.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name must contain at least one alphanumeric character",
    });
  }

  const hasScaffold = !!body.scaffoldId;
  const hasRepoUrl = !!body.repoUrl;

  if (hasScaffold && hasRepoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provide either scaffoldId or repoUrl, not both",
    });
  }

  if (!hasScaffold && !hasRepoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Either scaffoldId or repoUrl is required",
    });
  }

  let scaffoldId: string | null = null;
  let repoUrl: string | null = null;

  if (hasScaffold) {
    scaffoldId = body.scaffoldId!;
    const availableScaffolds = listScaffolds();
    if (!availableScaffolds.some((s) => s.id === scaffoldId)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid scaffold: "${scaffoldId}"`,
      });
    }
  } else {
    repoUrl = body.repoUrl!;
    if (!repoUrl.startsWith("https://github.com/")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Only GitHub repository URLs are supported",
      });
    }
  }

  const db = useDb();

  // Check if slug is unique for this user
  const existingSlug = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, user.id), eq(projects.slug, slug)))
    .limit(1);

  if (existingSlug.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "A project with this name already exists",
    });
  }

  // Check if repoUrl is already used by this user
  if (repoUrl) {
    const existingRepo = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, user.id), eq(projects.repoUrl, repoUrl)))
      .limit(1);

    if (existingRepo.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: "This repository is already linked to a project",
      });
    }
  }

  // Create the DB record with "creating" status
  const result = await db
    .insert(projects)
    .values({
      userId: user.id,
      name,
      slug,
      scaffoldId,
      status: "creating",
      repoUrl,
    })
    .returning({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      scaffoldId: projects.scaffoldId,
      status: projects.status,
      repoUrl: projects.repoUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });

  const project = result[0];

  // Fire and forget
  createProject(user.id, project.id, slug, scaffoldId).catch((err: unknown) => {
    console.error(`Failed to create project ${slug}:`, err);
  });

  setResponseStatus(event, 201);
  return { project };
});
```

**Step 8: Run all tests**

Run: `cd packages/app && bun run test`
Expected: All pass

**Step 9: Commit**

```bash
git add packages/app/server/api/projects/index.post.ts packages/app/server/utils/project-lifecycle.ts packages/app/tests/k8s/lifecycle.test.ts packages/app/tests/projects/crud.test.ts
git commit -m "Support importing existing repos via POST /api/projects with repoUrl"
```

---

## Phase 2: Frontend

### Task 4: Add tabs and import UI to `/new` page

**Files:**

- Modify: `packages/app/pages/new.vue`

**Step 1: Rewrite `packages/app/pages/new.vue`**

The page needs:

- Two tabs at top: "From Scaffold" (default) and "Import Repo"
- The scaffold tab content is the existing form (unchanged logic)
- The import tab:
  - Fetches repos from `GET /api/github/repos`
  - Shows a search input that filters client-side (the API returns up to 100 repos)
  - Displays repos as selectable cards (name, description, private badge, language)
  - When a repo is selected, auto-fills the project name (editable)
  - Shows slug preview
  - "Import" button submits to `POST /api/projects` with `{ name, repoUrl }`

Replace `packages/app/pages/new.vue` with the full implementation below. Key changes from the existing file:

- Add `activeTab` ref: `"scaffold" | "import"` (default `"scaffold"`)
- Add `selectedRepo` ref for the import tab
- Add `repos`, `reposLoading`, `reposError`, `searchQuery` refs
- Add `fetchRepos()` function that calls `GET /api/github/repos`
- Add `filteredRepos` computed that filters by `searchQuery`
- Modify `canCreate` to work for both tabs
- Modify `createProject` to send `repoUrl` when in import mode
- Add tab UI, repo list, search input

The full Vue file content:

```vue
<script setup lang="ts">
import type { Project } from "~/types/project";

interface Scaffold {
  id: string;
  name: string;
  description: string;
}

interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
  url: string;
}

const activeTab = ref<"scaffold" | "import">("scaffold");

// Shared state
const projectName = ref("");
const creating = ref(false);
const errorMsg = ref("");

// Scaffold state
const selectedScaffold = ref<string>("");
const scaffolds = ref<Scaffold[]>([]);
const scaffoldsLoading = ref(true);
const scaffoldsError = ref("");

// Import state
const selectedRepo = ref<GitHubRepo | null>(null);
const repos = ref<GitHubRepo[]>([]);
const reposLoading = ref(false);
const reposError = ref("");
const searchQuery = ref("");

function generateSlugPreview(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

const slugPreview = computed(() => generateSlugPreview(projectName.value));

const filteredRepos = computed(() => {
  if (!searchQuery.value) return repos.value;
  const q = searchQuery.value.toLowerCase();
  return repos.value.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)),
  );
});

const canCreate = computed(() => {
  if (creating.value) return false;
  if (projectName.value.trim().length === 0 || projectName.value.trim().length > 100) return false;

  if (activeTab.value === "scaffold") {
    return selectedScaffold.value !== "";
  } else {
    return selectedRepo.value !== null;
  }
});

async function fetchScaffolds() {
  scaffoldsLoading.value = true;
  scaffoldsError.value = "";
  try {
    const data = await $fetch<{ scaffolds: Scaffold[] }>("/api/scaffolds");
    scaffolds.value = data.scaffolds;
    if (data.scaffolds.length === 1) {
      selectedScaffold.value = data.scaffolds[0].id;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load scaffolds";
    scaffoldsError.value = msg;
  } finally {
    scaffoldsLoading.value = false;
  }
}

async function fetchRepos() {
  reposLoading.value = true;
  reposError.value = "";
  try {
    const data = await $fetch<{ repos: GitHubRepo[] }>("/api/github/repos");
    repos.value = data.repos;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load repositories";
    reposError.value = msg;
  } finally {
    reposLoading.value = false;
  }
}

function selectRepo(repo: GitHubRepo) {
  selectedRepo.value = repo;
  if (!projectName.value) {
    projectName.value = repo.name;
  }
}

async function createProject() {
  if (!canCreate.value) return;

  creating.value = true;
  errorMsg.value = "";

  try {
    const body: Record<string, string> = {
      name: projectName.value.trim(),
    };

    if (activeTab.value === "scaffold") {
      body.scaffoldId = selectedScaffold.value;
    } else {
      body.repoUrl = selectedRepo.value!.url;
    }

    await $fetch<{ project: Project }>("/api/projects", {
      method: "POST",
      body,
    });
    await navigateTo("/");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusMessage" in err) {
      errorMsg.value = (err as { statusMessage: string }).statusMessage;
    } else if (err instanceof Error) {
      errorMsg.value = err.message;
    } else {
      errorMsg.value = "Failed to create project";
    }
  } finally {
    creating.value = false;
  }
}

function switchTab(tab: "scaffold" | "import") {
  activeTab.value = tab;
  errorMsg.value = "";
  if (tab === "import" && repos.value.length === 0 && !reposLoading.value) {
    fetchRepos();
  }
}

onMounted(() => {
  fetchScaffolds();
});
</script>

<template>
  <div class="new-project">
    <div class="page-header">
      <h1 class="page-title">New Project</h1>
      <p class="page-subtitle">Create an isolated dev environment with Claude Code</p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'scaffold' }"
        @click="switchTab('scaffold')"
      >
        From Scaffold
      </button>
      <button class="tab" :class="{ active: activeTab === 'import' }" @click="switchTab('import')">
        Import Repo
      </button>
    </div>

    <!-- Scaffold tab -->
    <template v-if="activeTab === 'scaffold'">
      <div class="form-section">
        <label class="form-label">Template</label>

        <div v-if="scaffoldsLoading" class="scaffolds-loading">
          <div class="loading-spinner" />
          <span class="loading-text">Loading templates...</span>
        </div>

        <div v-else-if="scaffoldsError" class="scaffolds-error">
          <p class="error-text">{{ scaffoldsError }}</p>
          <button class="btn-retry" @click="fetchScaffolds">Try again</button>
        </div>

        <div v-else class="scaffold-grid">
          <button
            v-for="scaffold in scaffolds"
            :key="scaffold.id"
            class="scaffold-card"
            :class="{ selected: selectedScaffold === scaffold.id }"
            @click="selectedScaffold = scaffold.id"
          >
            <span class="scaffold-name">{{ scaffold.name }}</span>
            <span class="scaffold-description">{{ scaffold.description }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Import tab -->
    <template v-if="activeTab === 'import'">
      <div class="form-section">
        <label class="form-label">Repository</label>

        <div v-if="reposLoading" class="scaffolds-loading">
          <div class="loading-spinner" />
          <span class="loading-text">Loading repositories...</span>
        </div>

        <div v-else-if="reposError" class="scaffolds-error">
          <p class="error-text">{{ reposError }}</p>
          <button class="btn-retry" @click="fetchRepos">Try again</button>
        </div>

        <template v-else>
          <input
            v-model="searchQuery"
            type="text"
            class="form-input"
            placeholder="Search repositories..."
            autocomplete="off"
          />

          <div class="repo-list">
            <button
              v-for="repo in filteredRepos"
              :key="repo.fullName"
              class="repo-card"
              :class="{ selected: selectedRepo?.fullName === repo.fullName }"
              @click="selectRepo(repo)"
            >
              <div class="repo-header">
                <span class="repo-name">{{ repo.name }}</span>
                <span v-if="repo.isPrivate" class="repo-badge">Private</span>
              </div>
              <span v-if="repo.description" class="repo-description">{{ repo.description }}</span>
              <span v-if="repo.language" class="repo-language">{{ repo.language }}</span>
            </button>

            <div v-if="filteredRepos.length === 0" class="repo-empty">
              <span class="loading-text">{{
                searchQuery ? "No matching repositories" : "No repositories found"
              }}</span>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Project name input -->
    <div class="form-section">
      <label class="form-label" for="project-name">Project name</label>
      <input
        id="project-name"
        v-model="projectName"
        type="text"
        class="form-input"
        placeholder="My Awesome App"
        maxlength="100"
        autocomplete="off"
        @keydown.enter="createProject"
      />
      <div v-if="projectName.trim().length > 0" class="slug-preview">
        <span class="slug-label">Slug:</span>
        <span class="slug-value">{{ slugPreview }}</span>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="errorMsg" class="error-banner">
      <p class="error-text">{{ errorMsg }}</p>
    </div>

    <!-- Create button -->
    <button class="btn-create" :disabled="!canCreate" @click="createProject">
      <div v-if="creating" class="btn-spinner" />
      <span>{{
        creating
          ? activeTab === "scaffold"
            ? "Creating..."
            : "Importing..."
          : activeTab === "scaffold"
            ? "Create Project"
            : "Import Project"
      }}</span>
    </button>
  </div>
</template>
```

The `<style scoped>` section keeps all existing styles and adds:

```css
/* Tabs */
.tabs {
  display: flex;
  gap: var(--space-xs);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-xs);
}

.tab {
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

/* Repo list */
.repo-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 400px;
  overflow-y: auto;
}

.repo-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.repo-card:hover {
  border-color: var(--text-muted);
}

.repo-card.selected {
  border-color: var(--accent);
  background: var(--accent-glow);
  box-shadow: 0 0 0 1px var(--accent);
}

.repo-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.repo-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary);
}

.repo-badge {
  font-size: 0.6875rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-overlay);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.repo-description {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.repo-language {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.repo-empty {
  display: flex;
  justify-content: center;
  padding: var(--space-xl) var(--space-md);
}
```

**Step 2: Run all tests**

Run: `cd packages/app && bun run test`
Expected: All pass

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/app/pages/new.vue
git commit -m "Add import repo tab to new project page"
```

---

## Phase 3: Cleanup & Review

### Task 5: Code review

Dispatch `superpowers:code-reviewer` subagent to review all changes from Tasks 1-4 against the design doc at `docs/plans/2026-03-06-import-repo-design.md`.

### Task 6: Update documentation

**Files:**

- Modify: `CLAUDE.md` -- Update project creation section to mention import flow
- Modify: `docs/plans/2026-03-06-import-repo-design.md` -- Mark as implemented

Update the following sections in `CLAUDE.md`:

1. In the API endpoints list, add `GET /api/github/repos` endpoint description
2. In the project creation flow description, mention the import alternative
3. Note that `scaffoldId` is nullable (null = imported repo)
