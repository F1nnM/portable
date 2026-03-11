# V2 Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the entire frontend with a redesigned v2 UI -- warm orange-on-stone aesthetic, editor integrated into the main Nuxt app (eliminating the editor SPA package), onboarding flow, background query persistence, streaming chat with full markdown, and git diff view.

**Architecture:** The `packages/editor` SPA is retired. All editor UI becomes Nuxt pages and components within `packages/app`. Pod-server becomes a pure API/WebSocket backend. The auth relay flow and editor subdomain routing are removed. Only preview subdomains remain. Design tokens are rebuilt from scratch. The background-queries plan (`docs/plans/2026-03-10-background-queries-sdk-display.md`) is implemented as part of this.

**Tech Stack:** Nuxt 3, Vue 3, CSS custom properties (design tokens), CodeMirror 6, marked + DOMPurify (markdown), @anthropic-ai/claude-agent-sdk, Hono, httpxy

---

## Pre-Implementation: Backup Old UI

Before any implementation begins, move all existing v1 frontend files to a backup location so subagents start clean:

```bash
mkdir -p /tmp/portable-v1-backup
cp -r packages/app/pages /tmp/portable-v1-backup/pages
cp -r packages/app/components /tmp/portable-v1-backup/components
cp -r packages/app/layouts /tmp/portable-v1-backup/layouts
cp -r packages/app/composables /tmp/portable-v1-backup/composables
cp -r packages/app/middleware /tmp/portable-v1-backup/middleware
cp packages/app/assets/css/global.css /tmp/portable-v1-backup/global.css
cp packages/design-tokens/tokens.css /tmp/portable-v1-backup/tokens.css

# Remove v1 frontend files (server-side stays untouched)
rm packages/app/pages/index.vue packages/app/pages/login.vue packages/app/pages/settings.vue packages/app/pages/new.vue
rm packages/app/components/ProjectCard.vue
rm packages/app/layouts/default.vue
rm packages/app/composables/useAuth.ts
rm packages/app/middleware/auth.global.ts
rm packages/app/assets/css/global.css
rm packages/design-tokens/tokens.css

# Create empty placeholder files so Nuxt doesn't break
touch packages/app/assets/css/global.css
touch packages/design-tokens/tokens.css
```

Then commit: `git commit -m "Remove v1 frontend files in preparation for v2 redesign"`

The old editor SPA (`packages/editor`) stays for now -- it will be removed in Phase 7.

---

## Phase 1: Design Foundation

### Task 1.1: Rebuild Design Tokens

**Files:**

- Modify: `packages/design-tokens/tokens.css`

**Context:** The design tokens define all colors, typography, spacing, borders, shadows, and motion used across the entire app. The v2 palette uses warm orange accent on warm stone neutrals. Dark mode shifts the accent toward amber-gold.

**Step 1: Write the new design tokens**

```css
/*
 * Portable v2 Design Tokens
 * Warm orange-on-stone aesthetic with amber-gold dark mode accent
 */

/* ---- Light mode (default) ---- */
:root,
[data-theme="light"] {
  /* Backgrounds */
  --color-bg: #f6f4f1;
  --color-bg-surface: #ffffff;
  --color-bg-elevated: #faf9f7;
  --color-bg-inset: #efece8;

  /* Text */
  --color-text: #2c2825;
  --color-text-secondary: #6b6560;
  --color-text-muted: #a09890;

  /* Borders */
  --color-border: #e3dfda;
  --color-border-strong: #d0cbc4;

  /* Accent (burnished orange) */
  --color-accent: #d97a3e;
  --color-accent-hover: #c46a2e;
  --color-accent-active: #b05e28;
  --color-accent-tint: #fdf3ec;
  --color-accent-text: #ffffff;

  /* Semantic */
  --color-danger: #d64545;
  --color-danger-tint: #fdf0f0;
  --color-success: #3a8f5c;
  --color-success-tint: #eef8f2;
  --color-warning: #c4880c;
  --color-warning-tint: #fef8ec;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(44, 40, 37, 0.05);
  --shadow-card: 0 1px 4px rgba(44, 40, 37, 0.06), 0 0 0 1px rgba(44, 40, 37, 0.03);
  --shadow-elevated: 0 8px 24px rgba(44, 40, 37, 0.1), 0 2px 8px rgba(44, 40, 37, 0.04);
  --shadow-overlay: 0 16px 48px rgba(44, 40, 37, 0.16), 0 4px 12px rgba(44, 40, 37, 0.06);
}

/* ---- Dark mode ---- */
[data-theme="dark"] {
  --color-bg: #191715;
  --color-bg-surface: #231f1d;
  --color-bg-elevated: #2b2724;
  --color-bg-inset: #141210;

  --color-text: #ede8e3;
  --color-text-secondary: #9c9590;
  --color-text-muted: #6b6460;

  --color-border: #3a3532;
  --color-border-strong: #4a4440;

  /* Accent (amber-gold for dark mode) */
  --color-accent: #e0a04a;
  --color-accent-hover: #d08e38;
  --color-accent-active: #c07e2c;
  --color-accent-tint: #2e2418;
  --color-accent-text: #191715;

  --color-danger: #e05555;
  --color-danger-tint: #2e1a1a;
  --color-success: #4aaa6e;
  --color-success-tint: #1a2e20;
  --color-warning: #d4980c;
  --color-warning-tint: #2e2610;

  --shadow-sm: none;
  --shadow-card: 0 0 0 1px var(--color-border);
  --shadow-elevated: 0 0 0 1px var(--color-border);
  --shadow-overlay: 0 0 0 1px var(--color-border);
}

/* ---- System preference fallback ---- */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #191715;
    --color-bg-surface: #231f1d;
    --color-bg-elevated: #2b2724;
    --color-bg-inset: #141210;

    --color-text: #ede8e3;
    --color-text-secondary: #9c9590;
    --color-text-muted: #6b6460;

    --color-border: #3a3532;
    --color-border-strong: #4a4440;

    --color-accent: #e0a04a;
    --color-accent-hover: #d08e38;
    --color-accent-active: #c07e2c;
    --color-accent-tint: #2e2418;
    --color-accent-text: #191715;

    --color-danger: #e05555;
    --color-danger-tint: #2e1a1a;
    --color-success: #4aaa6e;
    --color-success-tint: #1a2e20;
    --color-warning: #d4980c;
    --color-warning-tint: #2e2610;

    --shadow-sm: none;
    --shadow-card: 0 0 0 1px var(--color-border);
    --shadow-elevated: 0 0 0 1px var(--color-border);
    --shadow-overlay: 0 0 0 1px var(--color-border);
  }
}

/* ---- Theme-independent tokens ---- */
:root {
  /* Typography */
  --font-sans: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;
  --font-size-xs: 0.75rem; /* 12px */
  --font-size-sm: 0.8125rem; /* 13px */
  --font-size-base: 0.9375rem; /* 15px */
  --font-size-lg: 1.125rem; /* 18px */
  --font-size-xl: 1.375rem; /* 22px */
  --font-size-2xl: 1.75rem; /* 28px */
  --font-weight-normal: 500;
  --font-weight-medium: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.3;
  --line-height-base: 1.6;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* Borders */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 350ms ease;

  /* Layout */
  --touch-min: 44px;
  --content-max-width: 960px;
  --sidebar-width: 280px;
}
```

**Step 2: Commit**

```bash
git add packages/design-tokens/tokens.css
git commit -m "Rebuild design tokens with warm orange-on-stone palette"
```

### Task 1.2: Write Global CSS Reset

**Files:**

- Modify: `packages/app/assets/css/global.css`

**Context:** Global CSS resets, typography defaults, scrollbar styling, and shared utility styles. Clean slate -- no reference to v1.

**Step 1: Write the global CSS**

```css
/* ---- Reset ---- */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ---- Base ---- */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  height: 100%;
}

body {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-base);
  color: var(--color-text);
  background-color: var(--color-bg);
  min-height: 100%;
}

/* ---- Typography ---- */
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
}

a {
  color: var(--color-accent);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-accent-hover);
}

/* ---- Form elements inherit ---- */
button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  outline: none;
}

button {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* ---- Images ---- */
img,
svg {
  display: block;
  max-width: 100%;
}

/* ---- Scrollbar ---- */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* ---- Selection ---- */
::selection {
  background: var(--color-accent-tint);
  color: var(--color-text);
}

/* ---- Page transitions ---- */
.page-enter-active,
.page-leave-active {
  transition: opacity var(--transition-base);
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
```

**Step 2: Commit**

```bash
git add packages/app/assets/css/global.css
git commit -m "Write v2 global CSS reset and base styles"
```

### Task 1.3: Update nuxt.config.ts theme-color

**Files:**

- Modify: `packages/app/nuxt.config.ts`

**Context:** The `<meta name="theme-color">` in the Nuxt config head still references the old v1 color `#fafaf9`. Update to the new v2 background color.

**Step 1: Update the theme-color meta tag**

In `packages/app/nuxt.config.ts`, find the `theme-color` meta tag inside `app.head.meta` and change its content from `#fafaf9` to `#f6f4f1`.

**Step 2: Commit**

```bash
git add packages/app/nuxt.config.ts
git commit -m "Update theme-color meta to v2 background"
```

---

## Phase 2: App Shell & Auth

### Task 2.1: Create Auth Composable (v2)

**Files:**

- Create: `packages/app/composables/useAuth.ts`

**Context:** Provides reactive auth state, credential status, refresh, and logout. The v2 version adds `hasCredential` and `hasAgeKey` refs for onboarding gating. Uses Nuxt's `useState` for SSR-safe state. Refer to the old composable at `/tmp/portable-v1-backup/composables/useAuth.ts` for API patterns only.

**Step 1: Write the test**

Create `packages/app/tests/composables/useAuth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("useAuth composable", () => {
  it("exports useAuth function", async () => {
    // Verify the composable module exists and exports correctly
    const mod = await import("../../composables/useAuth");
    expect(mod.useAuth).toBeDefined();
    expect(typeof mod.useAuth).toBe("function");
  });
});
```

**Step 2: Run test, verify it fails**

```bash
cd packages/app && bun run test -- tests/composables/useAuth.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement the composable**

```typescript
// packages/app/composables/useAuth.ts
import type { SessionUser } from "~/server/utils/auth";

interface AuthState {
  user: Ref<SessionUser | null>;
  isAuthenticated: ComputedRef<boolean>;
  hasCredential: Ref<boolean | null>;
  hasAgeKey: Ref<boolean | null>;
  isSetupComplete: ComputedRef<boolean>;
  refresh: () => Promise<SessionUser | null>;
  refreshCredentialStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const user = useState<SessionUser | null>("auth:user", () => null);
  const hasCredential = useState<boolean | null>("auth:hasCredential", () => null);
  const hasAgeKey = useState<boolean | null>("auth:hasAgeKey", () => null);

  const isAuthenticated = computed(() => !!user.value);
  const isSetupComplete = computed(() => hasCredential.value === true && hasAgeKey.value === true);

  async function refresh(): Promise<SessionUser | null> {
    try {
      const data = await $fetch<SessionUser>("/api/auth/me");
      user.value = data;
      return data;
    } catch {
      user.value = null;
      return null;
    }
  }

  async function refreshCredentialStatus(): Promise<void> {
    try {
      const [credResult, ageResult] = await Promise.all([
        $fetch<{ hasCredential: boolean }>("/api/settings/credential"),
        $fetch<{ hasAgeKey: boolean }>("/api/settings/age-key"),
      ]);
      hasCredential.value = credResult.hasCredential;
      hasAgeKey.value = ageResult.hasAgeKey;
    } catch {
      // If we can't fetch, leave as null (unknown)
    }
  }

  async function logout(): Promise<void> {
    await $fetch("/auth/logout", { method: "POST" });
    user.value = null;
    hasCredential.value = null;
    hasAgeKey.value = null;
    navigateTo("/login");
  }

  return {
    user,
    isAuthenticated,
    hasCredential,
    hasAgeKey,
    isSetupComplete,
    refresh,
    refreshCredentialStatus,
    logout,
  };
}
```

**Step 4: Run test, verify it passes**

```bash
cd packages/app && bun run test -- tests/composables/useAuth.test.ts
```

**Step 5: Commit**

```bash
git add packages/app/composables/useAuth.ts packages/app/tests/composables/useAuth.test.ts
git commit -m "Add v2 useAuth composable with credential status tracking"
```

### Task 2.2: Create Auth Middleware (v2)

**Files:**

- Create: `packages/app/middleware/auth.global.ts`

**Context:** Global route middleware. Redirects unauthenticated users to `/login`, authenticated users away from `/login`, and users without configured keys to `/onboarding`. Does NOT redirect from `/onboarding` to `/onboarding` (infinite loop guard).

**Step 1: Write the middleware**

```typescript
// packages/app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for server API routes and auth callbacks
  if (to.path.startsWith("/api/") || to.path.startsWith("/auth/")) return;

  const { user, isAuthenticated, isSetupComplete, refresh, refreshCredentialStatus } = useAuth();

  // On first load, fetch auth state
  if (user.value === null && !isAuthenticated.value) {
    await refresh();
  }

  const publicRoutes = ["/login"];
  const isPublic = publicRoutes.includes(to.path);

  // Unauthenticated: redirect to login
  if (!isAuthenticated.value && !isPublic) {
    return navigateTo("/login");
  }

  // Authenticated on login page: redirect to dashboard
  if (isAuthenticated.value && to.path === "/login") {
    return navigateTo("/");
  }

  // If authenticated, check credential status for onboarding gating
  if (isAuthenticated.value && to.path !== "/onboarding") {
    // Lazy-load credential status
    if (isSetupComplete.value === undefined || isSetupComplete.value === false) {
      await refreshCredentialStatus();
    }
    if (!isSetupComplete.value && to.path !== "/login") {
      return navigateTo("/onboarding");
    }
  }
});
```

**Step 2: Commit**

```bash
git add packages/app/middleware/auth.global.ts
git commit -m "Add v2 auth middleware with onboarding redirect"
```

### Task 2.3: Create Default Layout (v2)

**Files:**

- Create: `packages/app/layouts/default.vue`

**Context:** The app shell. Top bar with "Portable" wordmark on the left, "+" icon and user avatar on the right. No bottom nav -- just the top bar. The "+" icon links to `/projects/new` and is hidden when setup is incomplete. The user avatar opens `/settings`. This layout is used by dashboard, settings, onboarding, and new project pages. The project editor uses a different layout.

**Step 1: Write the layout**

```vue
<!-- packages/app/layouts/default.vue -->
<template>
  <div class="app-shell">
    <header class="topbar">
      <NuxtLink to="/" class="topbar-brand">portable</NuxtLink>
      <div class="topbar-actions">
        <NuxtLink
          v-if="isSetupComplete"
          to="/projects/new"
          class="topbar-btn"
          aria-label="New project"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <line x1="10" y1="4" x2="10" y2="16" />
            <line x1="4" y1="10" x2="16" y2="10" />
          </svg>
        </NuxtLink>
        <NuxtLink v-if="isAuthenticated" to="/settings" class="topbar-avatar" aria-label="Settings">
          <img
            v-if="user?.avatarUrl"
            :src="user.avatarUrl"
            :alt="user.username"
            class="avatar-img"
          />
          <span v-else class="avatar-fallback">{{ user?.username?.charAt(0)?.toUpperCase() }}</span>
        </NuxtLink>
      </div>
    </header>
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { user, isAuthenticated, isSetupComplete } = useAuth();
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-brand {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.02em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.topbar-btn:hover {
  background: var(--color-bg-inset);
  color: var(--color-text);
}

.topbar-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--color-accent-tint);
  transition: opacity var(--transition-fast);
}

.topbar-avatar:hover {
  opacity: 0.8;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-accent);
}

.main-content {
  flex: 1;
  padding: var(--space-5) var(--space-4);
  max-width: var(--content-max-width);
  width: 100%;
  margin: 0 auto;
}
</style>
```

**Step 2: Commit**

```bash
git add packages/app/layouts/default.vue
git commit -m "Add v2 default layout with topbar and user avatar"
```

**Note:** The `user.avatarUrl` field may not exist on the current `SessionUser` type. If so, the subagent should check `packages/app/server/utils/auth.ts` for the `SessionUser` interface and add `avatarUrl` if missing. GitHub OAuth provides `avatar_url` -- it should be stored during user upsert if not already. If it's not straightforward to add, use the fallback initial instead and skip the avatar URL for now.

### Task 2.4: Create Login Page (v2)

**Files:**

- Create: `packages/app/pages/login.vue`

**Context:** Clean, centered login page. Warm background, centered card with "portable" branding, "Sign in with GitHub" button, and a brief tagline. Shows error if `?error=not_allowed` query param present. Loads theme from localStorage on mount.

**Step 1: Write the page**

Create `packages/app/pages/login.vue` -- a standalone page that sets `layout: false` (no topbar). Contains:

- A centered card on the warm background
- "portable" wordmark
- "Your remote Claude Code environment" tagline
- "Sign in with GitHub" button linking to `/auth/github`
- Error message for `not_allowed` query param
- Theme loading from localStorage on mount (sets `data-theme` attribute on `<html>`)

Style: The card should have `--color-bg-surface` background, `--shadow-elevated` shadow, `--radius-lg` border radius. The button should be `--color-accent` background with `--color-accent-text` text. Page background is `--color-bg`.

**Step 2: Commit**

```bash
git add packages/app/pages/login.vue
git commit -m "Add v2 login page"
```

### Task 2.5: Create Settings Page (v2)

**Files:**

- Create: `packages/app/pages/settings.vue`

**Context:** Accessed via user avatar. Shows: username (read-only), theme toggle (System/Light/Dark), Anthropic credential management, AGE key management, logout button. Uses the default layout with the topbar.

Credential and AGE key management: For each, show whether it's configured (green dot + "Configured" or muted "Not configured"), a text input to save a new value, and a remove button if configured. Same API endpoints as v1:

- `GET /api/settings/credential` returns `{ hasCredential: boolean }`
- `PUT /api/settings/credential` with `{ credential: string }` to save, `{ credential: "" }` to remove
- `GET /api/settings/age-key` returns `{ hasAgeKey: boolean }`
- `PUT /api/settings/age-key` with `{ ageKey: string }` to save, `{ ageKey: "" }` to remove

Theme toggle persists to `localStorage` key `portable-theme` and sets `document.documentElement.dataset.theme`.

**Step 1: Write the page**

Create a clean settings page with sections for User, Theme, Anthropic Credential, and AGE Key. Each credential section follows the same pattern: status indicator, input field, save/remove buttons, inline success/error feedback. Include a logout button at the bottom styled as a danger action.

**Step 2: Commit**

```bash
git add packages/app/pages/settings.vue
git commit -m "Add v2 settings page with theme toggle and credential management"
```

### Task 2.6: Create Onboarding Page (v2)

**Files:**

- Create: `packages/app/pages/onboarding.vue`

**Context:** Step-by-step wizard shown when keys aren't configured. Four steps:

1. **Welcome**: Greets user by GitHub display name, explains Portable, "Let's get you set up" CTA
2. **Anthropic API Key**: Explains why needed. Two paths: OAuth token via `claude setup-token` or API key from console.anthropic.com. Input + save. Shows success inline.
3. **AGE Key**: Explains why needed. Shows terminal commands in copy-able code blocks: `age-keygen -o key.txt`, `cat key.txt`, reminder to store safely. Input + save. Shows success inline.
4. **Done**: "You're all set" confirmation, button to go to dashboard.

Uses same API endpoints as settings. Steps can be skipped forward if the corresponding key is already configured (e.g., if API key is set, start at step 2 or skip to 3). On completing all steps or if both keys already set, navigates to `/`.

Uses default layout (topbar visible).

**Step 1: Write the page**

Create the multi-step wizard. State: `currentStep` ref (1-4). Each step is a section with conditional rendering. Step transitions use a simple fade. "Back" button available on steps 2-3. Code blocks have a copy button (copies to clipboard on click).

**Step 2: Commit**

```bash
git add packages/app/pages/onboarding.vue
git commit -m "Add v2 onboarding wizard for API key and AGE key setup"
```

---

## Phase 3: Dashboard & Project Management

### Task 3.1: Create ProjectCard Component (v2)

**Files:**

- Create: `packages/app/components/ProjectCard.vue`

**Context:** Lightweight card displaying project name, status dot + label, and a three-dot menu. Clicking the card navigates to `/projects/:slug`. The menu contains: Start (if stopped/error), Stop (if running/starting), Rename, Delete, Open GitHub Repo.

Status dot colors: green for running (with pulse animation), gray for stopped, orange for starting/creating/stopping (with pulse), red for error. During transitional states, shows phase text (e.g., "Installing dependencies...") instead of the status label.

**Props:** `project: Project` (from `~/types/project` or server types)

**Emits:** `updated`, `deleted`, `starting`

The rename action shows an inline modal with a name input. Delete shows a confirmation modal with an option to delete the GitHub repo. "Open GitHub Repo" opens `project.repoUrl` in a new tab.

API calls for actions:

- Start: `POST /api/projects/:slug/start`
- Stop: `POST /api/projects/:slug/stop`
- Rename: `PATCH /api/projects/:slug` with `{ name: string }`
- Delete: `DELETE /api/projects/:slug?deleteRepo=true|false`
- Status polling: `GET /api/projects/:slug/status` every 2s during transitions

**Step 1: Write the test**

Create `packages/app/tests/components/ProjectCard.test.ts`. Test:

- Renders project name
- Shows correct status dot color
- Menu opens on three-dot click
- Emits `starting` when Start is clicked

**Step 2: Run test, verify it fails**

**Step 3: Implement the component**

Build a clean card with the project name as primary text, status indicator (dot + label or phase text), and a three-dot menu icon button. Use `<Teleport to="body">` for the modal overlay. Style uses design tokens.

**Step 4: Run test, verify it passes**

**Step 5: Commit**

```bash
git add packages/app/components/ProjectCard.vue packages/app/tests/components/ProjectCard.test.ts
git commit -m "Add v2 ProjectCard component with menu and status indicators"
```

### Task 3.2: Create Dashboard Page (v2)

**Files:**

- Create: `packages/app/pages/index.vue`

**Context:** The main dashboard. Fetches projects from `GET /api/projects`, displays them as a list of ProjectCard components. Auto-polls every 3s when any project is in a transitional state. Shows loading skeleton, error state with retry, and empty state.

**Step 1: Write the page**

```vue
<!-- packages/app/pages/index.vue -->
```

Fetch projects on mount. Display in a responsive grid (single column mobile, auto-fill on desktop). Empty state: friendly message + "Create your first project" button linking to `/projects/new`. Error state: message + retry button. Loading: skeleton cards.

The page re-fetches projects when returning from project creation (use `onActivated` or watch route).

**Step 2: Commit**

```bash
git add packages/app/pages/index.vue
git commit -m "Add v2 dashboard page with project grid"
```

### Task 3.3: Create New Project Page (v2)

**Files:**

- Create: `packages/app/pages/projects/new.vue`

**Context:** Two-tab creation: "From Scaffold" and "Import Repo".

Scaffold tab: Loads scaffolds from `GET /api/scaffolds`. Shows selectable cards. Auto-selects if only one.

Import tab: Loads repos from `GET /api/github/repos`. Search field filters client-side. Shows repo name, private badge, language, description. Selectable.

Common: Name input (max 100 chars). Create/Import button. Validates name required + scaffold/repo selected. On success: `POST /api/projects` then **auto-start** and redirect to `/projects/:slug` (the loading/status screen).

The auto-start means: after creating the project, immediately call `POST /api/projects/:slug/start` then navigate to `/projects/:slug`. The project loading screen will show the startup progress.

**Step 1: Write the page**

Two tabs with clean toggle. Scaffold cards are simple selectable items. Repo list has search bar + scrollable list. Name input at bottom. Submit button.

**Step 2: Commit**

```bash
git add packages/app/pages/projects/new.vue
git commit -m "Add v2 new project page with scaffold and import modes"
```

---

## Phase 4: Project View Shell & Loading Screen

### Task 4.1: Create Project Layout

**Files:**

- Create: `packages/app/layouts/project.vue`

**Context:** Layout for the project editor. Different from the default layout. Has:

- Top bar: back arrow (links to `/`), project name centered, status pill (colored badge)
- Bottom tab bar: Chat, Files, Git, Preview (4 tabs with SVG icons)
- Active tab highlighted with accent color top border

The bottom tab bar links are relative to the project: `/projects/:slug/chat`, `/projects/:slug/files`, `/projects/:slug/git`, `/projects/:slug/preview`.

The project slug comes from the route params (`useRoute().params.slug`).

**Step 1: Write the layout**

```vue
<!-- packages/app/layouts/project.vue -->
```

The layout needs to fetch the project info (name, status) to display in the top bar. It can use a composable or fetch from `GET /api/projects` and find the matching slug.

Bottom tab bar: fixed at bottom, 56px height. Each tab has an SVG icon + label. Active tab determined by route path match.

Main content area: fills remaining space between topbar and tab bar, `overflow: hidden` on the container.

**Step 2: Commit**

```bash
git add packages/app/layouts/project.vue
git commit -m "Add project layout with top bar and bottom tab bar"
```

### Task 4.2: Create Project Status/Loading Screen

**Files:**

- Create: `packages/app/pages/projects/[slug].vue`

**Context:** This is the parent route for all project pages. It acts as a gateway:

- If project is **running**: renders the child route (chat/files/git/preview) using the project layout
- If project is **starting/creating**: shows the loading/status screen with progress phases
- If project is **stopped**: shows "This project is stopped" with a Start button
- If project is **error**: shows error message with "Try again" button

Fetches project from `GET /api/projects` (find by slug). Polls `GET /api/projects/:slug/status` every 2s during transitions. When project reaches "running", auto-navigates to `/projects/:slug/chat`.

Progress phases (from `GET /api/projects/:slug/status`):

- creating_database, creating_repository, pushing_scaffold (creation phases from `creation-phase.ts`)
- initializing, cloning, installing, starting_server, ready (pod setup phases from pod-server health)

Display as a vertical checklist where completed phases get a checkmark and the current phase has a spinner.

Phase label mapping:

- `creating_database` → "Setting up database..."
- `creating_repository` → "Creating repository..."
- `pushing_scaffold` → "Scaffolding application..."
- `initializing` → "Initializing workspace..."
- `cloning` → "Cloning repository..."
- `installing` → "Installing dependencies..."
- `starting_server` → "Starting server..."
- `ready` → "Ready"

**Step 1: Write the page**

```vue
<!-- packages/app/pages/projects/[slug].vue -->
<script setup lang="ts">
definePageMeta({
  layout: false, // We conditionally apply layout based on project status
});
</script>
```

The page should detect project status and either show the loading/stopped/error screen (no layout, just centered content) or render `<NuxtLayout name="project"><NuxtPage /></NuxtLayout>` for child routes when the project is running.

**Step 2: Commit**

```bash
git add packages/app/pages/projects/[slug].vue
git commit -m "Add project status gateway with loading screen and progress phases"
```

---

## Phase 5: Pod-Server Backend Changes

This phase implements the background-queries plan from `docs/plans/2026-03-10-background-queries-sdk-display.md`, plus a new git diff endpoint.

### Task 5.1: Create Session Manager ∥

**Files:**

- Create: `packages/pod-server/src/session-manager.ts`
- Create: `packages/pod-server/tests/session-manager.test.ts`

**Context:** Module-level singleton managing background sessions. Sessions persist queries independent of WebSocket connections. Full spec is in the background-queries plan, Task 1.

Interface:

```typescript
interface BackgroundSession {
  id: string;
  sdkSessionId: string | null;
  activeQuery: Query | null;
  isRunning: boolean;
  isFirstQuery: boolean;
  pendingPrompt: string | null;
  currentQueryEvents: OutboundMessage[];
  clients: Set<WSContext<NodeWebSocket>>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}
```

Exported functions: `createSession()`, `getSession(id)`, `getSessionBySdkId(sdkSessionId)`, `getActiveSdkSessionIds()`, `attachClient(session, ws)`, `detachClient(session, ws)`, `sendMessage(session, prompt)`, `interruptQuery(session)`.

Core behavior: `runQuery()` is private, fire-and-forget. Buffers events, broadcasts to connected clients, starts cleanup timer when no clients remain after query ends.

**Step 1: Write tests** -- Session CRUD, attach/detach, query continues after detach, event buffering, reconnect replay, cleanup timer, pending prompt queuing.

**Step 2: Run tests, verify they fail**

**Step 3: Implement session-manager.ts**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 5.2: Rewrite ws.ts to Delegate to Session Manager ∥

**Files:**

- Modify: `packages/pod-server/src/routes/ws.ts`
- Modify: `packages/pod-server/tests/ws.test.ts`

**Context:** Remove `ConnectionState` and `runQuery` from ws.ts. The WS route becomes a thin bridge:

- `onOpen`: Check `?session=<sdkSessionId>`. If active background session exists, attach and replay. Otherwise create new.
- `onMessage`: Delegate to `sendMessage()` or `interruptQuery()`
- `onClose`/`onError`: `detachClient()` -- query keeps running

Replay protocol: send `{ type: "replay_start" }`, then all buffered events, then `{ type: "replay_end" }`.

**Step 1: Update tests** -- Remove "calls close() on disconnect". Add "query continues after disconnect", "reconnect replays buffered events", "reconnect to completed query does not replay".

**Step 2: Run tests, verify they fail**

**Step 3: Rewrite ws.ts**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 5.3: Create Active Sessions Endpoint ∥

**Files:**

- Create: `packages/pod-server/src/routes/active-sessions.ts`
- Create: `packages/pod-server/tests/active-sessions.test.ts`
- Modify: `packages/pod-server/src/app.ts` (register route)

**Context:** `GET /api/sessions/active` returns `{ activeSessionIds: string[] }` -- SDK session IDs with running queries.

**Step 1: Write test**

**Step 2: Run test, verify it fails**

**Step 3: Implement endpoint and register in app.ts**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 5.4: Update Sessions API for Thinking Blocks

**Files:**

- Modify: `packages/pod-server/src/routes/sessions.ts`
- Modify: `packages/pod-server/tests/sessions.test.ts`

**Context:** The `GET /api/sessions/:id/messages` endpoint currently only extracts `text` and `tool_use` blocks. Add `thinking` block extraction so loaded session history includes thinking blocks.

Add to the response per message:

```typescript
thinking: blocks
  .filter((b) => b.type === "thinking")
  .map((b) => ({ content: (b as any).thinking || "" }));
```

**Step 1: Add test** for thinking block extraction in session messages

**Step 2: Run test, verify it fails**

**Step 3: Update sessions.ts**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 5.5: Create Git Diff Endpoint

**Files:**

- Create: `packages/pod-server/src/routes/git-diff.ts` (or add to existing `git.ts`)
- Update tests accordingly

**Context:** `GET /api/git/diff/:path` returns the diff for a specific file. Uses `git diff` (for unstaged) or `git diff --cached` (for staged). The `path` param is the file path relative to the workspace. Accept a `?staged=true` query param to get staged diff.

Returns `{ diff: string }` with the raw diff output, or 404 if no changes for that file.

**Step 1: Write test**

**Step 2: Run test, verify it fails**

**Step 3: Implement endpoint**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

---

## Phase 6: Editor Frontend (Chat, Files, Git, Preview)

### Task 6.1: Create useWebSocket Composable (v2)

**Files:**

- Create: `packages/app/composables/useWebSocket.ts`
- Create: `packages/app/tests/composables/useWebSocket.test.ts`

**Context:** This is the most complex composable. It manages the WebSocket connection to the pod server's bridge, processes streaming deltas, handles replay on reconnect, and accumulates messages with thinking blocks, tool use, and result metadata.

The WebSocket URL is proxied through the main app: the pod server is accessed via the existing proxy at `ws://<main-app-host>/api/projects/:slug/ws` (needs a new proxy route -- see Task 6.6). Alternatively, the composable can connect to the pod's WebSocket through the existing subdomain proxy. **Decision: use direct main-app proxy route since editor is now part of the main app.**

Wait -- the main app currently proxies subdomain requests to pods. Since we're removing editor subdomains, we need a new way to route API requests from the editor pages to the pod server. The simplest approach: add a catch-all proxy route in the Nuxt server that forwards `/api/projects/:slug/pod/*` to the pod's API. This is Task 6.6.

Types:

```typescript
interface ThinkingEntry {
  content: string;
}
interface ToolUseEntry {
  name: string;
  input: string;
}
interface ResultMeta {
  costUsd: number;
  durationMs: number;
  numTurns: number;
  isError: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolUse?: ToolUseEntry[];
  thinking?: ThinkingEntry[];
  resultMeta?: ResultMeta;
}
```

Message handling: Process `stream_event` messages for real-time text/thinking deltas. Process `assistant` messages for complete content blocks. Process `result` messages for metadata. Handle `replay_start`/`replay_end` for reconnection.

**Step 1: Write tests** -- connection, send, streaming deltas, tool use accumulation, thinking block accumulation, result metadata, replay, reconnect URL fix, session ID tracking

**Step 2: Run tests, verify they fail**

**Step 3: Implement composable** following the spec in the background-queries plan Task 4

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.2: Create useSessions Composable (v2)

**Files:**

- Create: `packages/app/composables/useSessions.ts`
- Create: `packages/app/tests/composables/useSessions.test.ts`

**Context:** Fetches and manages conversation sessions. Uses the pod proxy route (`/api/projects/:slug/pod/api/sessions`). Adds `fetchActiveSessions()` for background query indicators.

API calls (through pod proxy):

- `GET /api/projects/:slug/pod/api/sessions` - list sessions
- `GET /api/projects/:slug/pod/api/sessions/:id/messages` - load messages (now includes thinking blocks)
- `DELETE /api/projects/:slug/pod/api/sessions/:id` - delete session
- `GET /api/projects/:slug/pod/api/sessions/active` - active sessions

The composable takes the project slug as a parameter.

**Step 1: Write tests**

**Step 2: Run tests, verify they fail**

**Step 3: Implement composable**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.3: Create useFiles Composable (v2)

**Files:**

- Create: `packages/app/composables/useFiles.ts`
- Create: `packages/app/tests/composables/useFiles.test.ts`

**Context:** File tree building and file read/write. Same logic as the old editor composable but routes through the pod proxy. Takes project slug as parameter.

API calls:

- `GET /api/projects/:slug/pod/api/files` - file list
- `GET /api/projects/:slug/pod/api/files/:path` - read file
- `PUT /api/projects/:slug/pod/api/files/:path` - write file

Uses module-level state pattern (shared refs across callers for the same slug).

**Step 1: Write tests** -- tree building, file read/write, module-level state

**Step 2: Run tests, verify they fail**

**Step 3: Implement composable**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.4: Create useGit Composable (v2)

**Files:**

- Create: `packages/app/composables/useGit.ts`
- Create: `packages/app/tests/composables/useGit.test.ts`

**Context:** Git status and diff fetching. Routes through pod proxy. Takes project slug as parameter.

API calls:

- `GET /api/projects/:slug/pod/api/git` - git status
- `GET /api/projects/:slug/pod/api/git/diff/:path?staged=true|false` - file diff

**Step 1: Write tests**

**Step 2: Run tests, verify they fail**

**Step 3: Implement composable**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.5: Install Markdown Dependencies

**Files:**

- Modify: `packages/app/package.json`

**Context:** Install `marked` and `dompurify` (+ types) for markdown rendering in chat messages. Also install `highlight.js` for code block syntax highlighting within markdown.

```bash
cd packages/app && bun add marked dompurify highlight.js && bun add -D @types/dompurify
```

**Step 1: Install and commit**

```bash
git add packages/app/package.json bun.lock
git commit -m "Add marked, dompurify, and highlight.js for markdown rendering"
```

### Task 6.6: Create Pod Proxy Route

**Files:**

- Create: `packages/app/server/routes/api/projects/[slug]/pod/[...path].ts`

**Context:** Catch-all server route that proxies requests from the editor pages to the pod server. This replaces the subdomain-based proxy for editor API access.

The route:

1. Validates the user is authenticated
2. Looks up the project by slug, verifies it belongs to the user and is running
3. Builds the pod service URL: `http://project-<slug>.<namespace>.svc.cluster.local:3000/<path>`
4. Proxies the request using `proxyRequest` from h3

For WebSocket connections (the chat bridge), this route won't work directly since `proxyRequest` doesn't handle WebSocket upgrades. WebSocket proxying needs to be handled in the Nitro plugin or via a dedicated approach. **Decision:** Keep the WebSocket path through the existing proxy plugin but change the routing. Instead of subdomain-based, use a path-based approach: the WS connection URL will be `ws://<main-app-host>/api/projects/:slug/pod/ws` and the proxy plugin will intercept requests matching this pattern.

Actually, simpler: use `proxyRequest` from h3 for HTTP, and for the WebSocket case, add a handler in the existing `plugins/proxy.ts` Nitro plugin that intercepts `upgrade` requests matching `/api/projects/:slug/pod/ws`.

**Step 1: Write the HTTP proxy route**

```typescript
// packages/app/server/routes/api/projects/[slug]/pod/[...path].ts
export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const slug = getRouterParam(event, "slug");
  const path = getRouterParam(event, "path") || "";

  // Look up project, verify ownership and running status
  // Build target URL and proxy
  const { podNamespace } = getK8sConfig();
  const target = `http://project-${slug}.${podNamespace}.svc.cluster.local:3000/${path}`;

  return proxyRequest(event, target);
});
```

**Step 2: Add WebSocket proxy for pod path**

In `packages/app/server/plugins/proxy.ts`, add handling for path-based pod WebSocket connections. Before the existing subdomain check, add:

```typescript
// Path-based pod WebSocket proxy: /api/projects/:slug/pod/ws
const podWsMatch = (event.node.req.url || "").match(/^\/api\/projects\/([^/]+)\/pod\/ws/);
if (podWsMatch && isWebSocket) {
  // Validate session, look up project, proxy to pod WS
}
```

**Step 3: Commit**

```bash
git add packages/app/server/routes/api/projects/[slug]/pod/[...path].ts packages/app/server/plugins/proxy.ts
git commit -m "Add path-based pod proxy route for editor API and WebSocket access"
```

### Task 6.7: Create ChatMessage Component (v2)

**Files:**

- Create: `packages/app/components/chat/ChatMessage.vue`
- Create: `packages/app/tests/components/ChatMessage.test.ts`

**Context:** Renders messages in the chat thread. Two styles:

**User messages:** Right-aligned bubble with `--color-accent-tint` background, compact, max-width 85%.

**Assistant messages:** Full-width, left-aligned. Content rendered as markdown using `marked` + `DOMPurify`. Includes:

- Full markdown: headings, bold/italic, lists, links, blockquotes, inline code
- Code blocks with syntax highlighting via highlight.js
- Tables in horizontally scrollable containers (wrap `<table>` in overflow-x: auto div)
- **Tool use**: inline, visually recessed -- smaller font, muted color, shows tool name. Always visible.
- **Thinking blocks**: collapsible line "Thought for Xs". Tap to expand. Dimmed/muted style.
- **Result metadata**: small footer with turns, duration, cost.

Markdown configuration:

```typescript
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

function renderMarkdown(text: string): string {
  const html = marked.parse(text) as string;
  return DOMPurify.sanitize(html);
}
```

**Step 1: Write tests** -- user message rendering, assistant markdown rendering, tool use display, thinking block collapse/expand

**Step 2: Run tests, verify they fail**

**Step 3: Implement component**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.8: Create ChatInput Component (v2)

**Files:**

- Create: `packages/app/components/chat/ChatInput.vue`
- Create: `packages/app/tests/components/ChatInput.test.ts`

**Context:** Auto-growing textarea with send/interrupt buttons. Props: `isStreaming: boolean`. Emits: `send(content)`, `interrupt()`.

- Enter sends, Shift+Enter for newline
- Textarea auto-grows up to ~150px then scrolls
- Send button styled with `--color-accent` background, circular
- Interrupt button replaces send during streaming (different icon, same position)
- Cannot send empty messages

**Step 1: Write tests**

**Step 2: Run tests, verify they fail**

**Step 3: Implement component**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.9: Create SessionList Component (v2)

**Files:**

- Create: `packages/app/components/chat/SessionList.vue`
- Create: `packages/app/tests/components/SessionList.test.ts`

**Context:** Lists saved conversations. Props: `slug: string`. Emits: `select(sessionId)`, `newSession()`.

- Conversations sorted most recent first
- Each entry: title + relative time ("2m ago")
- Tap to select (emit)
- Delete via swipe-left gesture or long-press
- "New conversation" button at top
- Pulsing dot on sessions with active background queries
- Empty state: "No conversations yet" + CTA

Uses `useSessions(slug)` composable.

**Step 1: Write tests**

**Step 2: Run tests, verify they fail**

**Step 3: Implement component**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.10: Create Chat Page (v2)

**Files:**

- Create: `packages/app/pages/projects/[slug]/chat.vue`

**Context:** The chat page has two states: session list (default) and active conversation.

**Session list state:** Renders SessionList component. On `select`, loads session messages and switches to chat state. On `newSession`, switches to chat state with empty messages.

**Chat state:** Renders message thread (ChatMessage for each message) + ChatInput at bottom. Back button returns to session list. Uses `useWebSocket` composable for the active connection.

The WebSocket URL: `ws://<host>/api/projects/:slug/pod/ws?session=<sessionId>` (for resuming) or without query param (for new).

Features: auto-scroll to bottom, streaming indicator (pulsing dots), tool progress indicators.

**Step 1: Write the page**

**Step 2: Commit**

### Task 6.11: Create FileTree Component (v2)

**Files:**

- Create: `packages/app/components/files/FileTree.vue`
- Create: `packages/app/tests/components/FileTree.test.ts`

**Context:** Recursive tree rendering. Props: `nodes: FileTreeNode[]`, `depth?: number`. Emits: `select(path)`.

- Directories before files, alphabetical
- Expand/collapse with chevron animation
- Indent guides (vertical lines)
- File-type icons if a lightweight library is available (check for `file-icons-js`, `vscode-icons-js`, or similar -- if none works easily, use simple folder/file SVG icons)
- Dimmed file extensions
- Touch-optimized (44px min height)

**Step 1: Write tests**

**Step 2: Run tests, verify they fail**

**Step 3: Implement component**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.12: Create CodeViewer Component (v2)

**Files:**

- Create: `packages/app/components/files/CodeViewer.vue`
- Create: `packages/app/tests/components/CodeViewer.test.ts`

**Context:** CodeMirror 6 editor. Props: `path: string`, `content: string`, `isEditing: boolean`. Emits: `back()`, `toggleEdit()`, `save()`, `contentChange(content)`.

- Language detection for JS/TS/JSX/TSX/JSON/CSS/SCSS/HTML/Vue/Markdown
- Custom theme using v2 design tokens (warm tones)
- Read-only by default, edit toggle switches to editable
- Save button in edit mode
- Header: back button, filename, edit/save buttons

Install CodeMirror dependencies in `packages/app`:

```bash
cd packages/app && bun add codemirror @codemirror/lang-javascript @codemirror/lang-json @codemirror/lang-css @codemirror/lang-html @codemirror/lang-markdown @codemirror/state @codemirror/view @codemirror/language @lezer/highlight
```

**Step 1: Install dependencies and commit**

**Step 2: Write tests**

**Step 3: Run tests, verify they fail**

**Step 4: Implement component** with a warm-toned CodeMirror theme

**Step 5: Run tests, verify they pass**

**Step 6: Commit**

### Task 6.13: Create Files Page (v2)

**Files:**

- Create: `packages/app/pages/projects/[slug]/files.vue`

**Context:** File browsing and editing. Two states: file tree (default) and code viewer.

Uses `useFiles(slug)` composable. On mount, fetches file tree. Clicking a file loads content and shows CodeViewer. Back button returns to tree. Edit toggle, save.

**Step 1: Write the page**

**Step 2: Commit**

### Task 6.14: Create DiffViewer Component (v2)

**Files:**

- Create: `packages/app/components/git/DiffViewer.vue`
- Create: `packages/app/tests/components/DiffViewer.test.ts`

**Context:** Renders a unified diff with syntax-highlighted added/removed lines. Props: `diff: string`, `path: string`. Emits: `back()`, `openFile()`.

Parses the raw diff string into lines. Lines starting with `+` (not `+++`) are additions (green tint background). Lines starting with `-` (not `---`) are deletions (red tint background). `@@` lines are section headers (muted). Other lines are context (normal).

Header: back button, filename, "View full file" link.

**Step 1: Write tests** -- renders added lines green, removed lines red, context lines normal

**Step 2: Run tests, verify they fail**

**Step 3: Implement component**

**Step 4: Run tests, verify they pass**

**Step 5: Commit**

### Task 6.15: Create Git Page (v2)

**Files:**

- Create: `packages/app/pages/projects/[slug]/git.vue`

**Context:** Git status view. Two states: status overview (default) and diff viewer.

Uses `useGit(slug)` composable. Shows branch name, staged changes, unstaged changes, commit history. Clicking a changed file fetches its diff and shows DiffViewer. DiffViewer has a "View full file" link that navigates to the Files tab with that file open.

**Step 1: Write the page**

**Step 2: Commit**

### Task 6.16: Create Preview Page (v2)

**Files:**

- Create: `packages/app/pages/projects/[slug]/preview.vue`

**Context:** Full-height iframe showing the project's dev server. The preview URL is constructed from the current hostname: `<slug>--preview--<appLabel>.<parentDomain>` (same pattern as before -- preview still uses subdomains).

- White background on iframe container (prevents bleed-through)
- Thin header: "Preview" label, URL, refresh button, open-in-new-tab button
- Loading overlay while iframe loads

**Step 1: Write the page**

**Step 2: Commit**

---

## Phase 7: Cleanup & Proxy Simplification

### Task 7.1: Simplify Proxy Layer (Remove Editor Subdomain)

**Files:**

- Modify: `packages/app/server/utils/proxy-shared.ts`
- Modify: `packages/app/server/utils/proxy.ts`
- Modify: `packages/app/server/plugins/proxy.ts`
- Modify: `packages/app/nuxt.config.ts` (dev proxy)

**Context:** The editor subdomain (`<slug>--portable.example.com`) is no longer used. Only preview subdomains (`<slug>--preview--portable.example.com`) remain. Simplify the proxy:

- `parseSubdomain()`: remove `"editor"` type. Only return `"preview"` type. Non-preview subdomains should return null (treated as main app).
- `buildProxyTarget()`: only needs to handle preview (port 3001). Remove port 3000 editor case.
- `resolveProxyTarget()`: simplify accordingly.
- Proxy plugin: remove editor-related proxy code. Keep preview proxying and the new path-based pod proxy.
- Dev proxy in nuxt.config.ts: simplify to only handle preview subdomains + the path-based pod proxy.

**Step 1: Update proxy-shared.ts** -- simplify `parseSubdomain` and `buildProxyTarget`

**Step 2: Update proxy.ts** -- simplify `resolveProxyTarget`

**Step 3: Update plugins/proxy.ts** -- remove editor subdomain handling, keep preview + path-based pod WS

**Step 4: Update nuxt.config.ts** -- simplify dev proxy

**Step 5: Run existing proxy tests and fix any broken ones**

**Step 6: Commit**

### Task 7.2: Remove Auth Relay Flow

**Files:**

- Delete: `packages/app/server/routes/auth/relay.get.ts`
- Delete: `packages/app/server/utils/relay-token.ts`
- Modify: `packages/app/server/plugins/proxy.ts` (remove relay token handling)
- Modify: `packages/app/nuxt.config.ts` (remove relay from dev proxy)

**Context:** The auth relay flow was needed to transfer session cookies to editor subdomains. Since the editor is now part of the main app, this flow is unnecessary. Preview subdomains don't need auth relay because preview iframe requests don't need authenticated sessions (they go to the dev server which has no auth).

Actually -- wait. Preview subdomains still proxy to the pod's dev server (port 3001). The current proxy validates the user session before proxying to the preview. With the relay removed, preview subdomain requests would fail auth. Two options:

1. Keep auth relay just for preview
2. Remove auth from preview proxying (the dev server output is the user's own project, and the preview is loaded in an iframe from the authenticated main app page)

**Decision:** Remove auth from preview proxying. The preview shows the user's own dev server output, and the iframe is loaded from within the authenticated app. The pod is already isolated by network policy. This simplifies everything.

Update the proxy to skip auth validation for preview subdomains.

**Step 1: Delete relay files**

**Step 2: Update proxy plugin to skip auth for preview subdomains**

**Step 3: Update dev proxy in nuxt.config.ts to skip auth for preview**

**Step 4: Run tests, fix breakages**

**Step 5: Commit**

### Task 7.3: Remove Editor SPA Package

**Files:**

- Delete: `packages/editor/` (entire directory)
- Modify: `package.json` (root) -- remove editor from workspaces if listed
- Modify: `Tiltfile` -- remove editor build/deploy steps if any
- Modify: `Dockerfile` or build configs -- remove editor build steps

**Context:** The editor SPA has been fully replaced by Nuxt pages/components. Clean up all references.

**Step 1: Check for references to `@portable/editor` or `packages/editor` in the codebase**

```bash
grep -r "editor" Tiltfile package.json .github/ Dockerfile* --include="*.ts" --include="*.json" --include="*.yaml" --include="*.yml" -l
```

**Step 2: Remove the package and all references**

**Step 3: Verify `bun install` still works**

**Step 4: Commit**

### Task 7.4: Remove Editor Static File Serving from Pod Server

**Files:**

- Modify: `packages/pod-server/src/app.ts` -- remove `registerStaticFiles()` call and function
- Modify: `packages/pod-server/src/index.ts` -- remove static file registration

**Context:** The pod server no longer needs to serve the editor SPA files. It's now a pure API/WebSocket backend.

**Step 1: Remove static file serving code**

**Step 2: Run pod-server tests to verify nothing breaks**

```bash
cd packages/pod-server && bun run test
```

**Step 3: Commit**

---

## Phase 8: Testing, Code Review & Documentation

### Task 8.1: Run Full Test Suite

```bash
bun run test
```

Fix any failures.

### Task 8.2: Run Linting and Type Checking

```bash
bun run lint:fix
bun run typecheck
```

Fix any issues.

### Task 8.3: Code Review

Use `superpowers:code-reviewer` subagent to review all changes against this plan and the design document.

### Task 8.4: Update Documentation

Update these files:

- `CLAUDE.md` -- update architecture section (editor integrated into main app, new routes, pod proxy, removed auth relay, removed editor subdomains)
- `docs/architecture.md` -- update component diagram
- Update any other docs that reference the editor SPA, subdomain routing, or auth relay

### Task 8.5: Final Commit

```bash
git add -A
git commit -m "Complete v2 frontend redesign: integrated editor, warm orange theme, onboarding, background queries"
```

---

## Verification Checklist

1. `bun run test` -- all tests pass
2. `bun run lint` -- no lint errors
3. `bun run typecheck` -- no type errors
4. Manual testing in dev environment:
   - Login page renders with warm theme
   - Onboarding wizard completes successfully
   - Dashboard shows projects with correct status indicators
   - Creating a project redirects to loading screen
   - Loading screen shows progress phases
   - Running project opens editor with bottom tabs
   - Chat: streaming messages render as markdown in real-time
   - Chat: tool use appears inline, muted
   - Chat: thinking blocks collapsible
   - Chat: background queries survive navigation
   - Files: tree loads, files open in CodeMirror
   - Files: edit and save works
   - Git: status shows changes, commit history
   - Git: clicking changed file shows diff view
   - Preview: iframe loads with white background
   - Settings: theme toggle, credential management
   - Light/dark mode works throughout
