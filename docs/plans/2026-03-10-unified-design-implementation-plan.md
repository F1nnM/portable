# Unified Design System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the divergent visual designs of the main app (terminal/green) and editor SPA (GitHub-dark/blue) with a unified design system: warm indigo accent, Plus Jakarta Sans typography, light/dark theme support, clean and calm aesthetic.

**Architecture:** A new `packages/design-tokens` package provides a single CSS file with all design tokens (colors, spacing, typography, radii) for both light and dark themes. Both the main app (Nuxt) and editor SPA (Vue/Vite) import this shared CSS. Each app is then restyled to use the unified tokens. Theme preference is stored in localStorage and respects `prefers-color-scheme` as default.

**Tech Stack:** CSS custom properties, Plus Jakarta Sans + JetBrains Mono (Google Fonts), CodeMirror 6 custom theme, Vue 3, Nuxt 3.

**Design spec:** `docs/plans/2026-03-10-unified-design-system.md` -- read this file for exact color values, spacing, typography, and component specs.

---

## Phase 1: Design Tokens Foundation

### Task 1: Create design tokens package ∥

**Files:**

- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tokens.css`

**Context:** This package provides the single source of truth for all design tokens. Both the main app and editor import this CSS file directly -- no build step needed. The CSS defines tokens for light mode at `:root` level, dark mode via `[data-theme="dark"]`, light mode explicitly via `[data-theme="light"]`, and a `prefers-color-scheme` fallback.

**Step 1: Create package.json**

Create `packages/design-tokens/package.json`:

```json
{
  "name": "@portable/design-tokens",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "exports": {
    "./tokens.css": "./tokens.css"
  },
  "files": ["tokens.css"]
}
```

**Step 2: Create tokens.css**

Create `packages/design-tokens/tokens.css` with all design tokens from the design spec. Structure:

1. `:root` -- light mode defaults (background, surface, text, border tokens)
2. `:root` -- theme-independent tokens (accent, danger, success, warning, spacing, radii, typography, transitions, touch-min, shadows)
3. `[data-theme="dark"]` -- dark mode overrides for background, surface, text, border tokens
4. `[data-theme="light"]` -- explicit light mode (same as :root defaults, for when manually selected)
5. `@media (prefers-color-scheme: dark)` with `:root:not([data-theme])` -- system dark mode fallback when no explicit theme is set

Use exact values from the design spec (`docs/plans/2026-03-10-unified-design-system.md`):

Light mode backgrounds: `--color-bg: #fafaf9`, `--color-bg-surface: #ffffff`, `--color-bg-elevated: #f0f0ee`
Dark mode backgrounds: `--color-bg: #16161a`, `--color-bg-surface: #1e1e24`, `--color-bg-elevated: #26262e`

Accent: `--color-accent: #6366F1`, `--color-accent-hover: #818CF8`
Accent tint: different per theme -- `rgba(99,102,241,0.08)` in light, `rgba(99,102,241,0.15)` in dark.

Fonts: `--font-sans: "Plus Jakarta Sans", system-ui, sans-serif`, `--font-mono: "JetBrains Mono", ui-monospace, monospace`

Spacing: `--space-1: 4px` through `--space-8: 64px`
Radii: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`
Transitions: `--transition-fast: 150ms ease`, `--transition-base: 250ms ease`
Touch: `--touch-min: 44px`

Shadow tokens (only visible in light mode):
`--shadow-card: 0 1px 3px rgba(0,0,0,0.06)` in light, `none` in dark
`--shadow-elevated: 0 8px 24px rgba(0,0,0,0.08)` in light, `none` in dark

**Step 3: Install the package dependency**

Run: `cd /home/finn/Repos/portable && bun install`

This resolves the workspace link for `@portable/design-tokens` since `packages/*` is already in workspace config.

**Step 4: Verify the package is accessible**

Run: `ls packages/design-tokens/tokens.css`
Expected: file exists

**Step 5: Commit**

```bash
git add packages/design-tokens/
git commit -m "Add shared design tokens package with light/dark theme support"
```

---

## Phase 2: Main App Redesign

### Task 2: Update main app infrastructure (fonts, tokens import, global.css) ∥

**Files:**

- Modify: `packages/app/nuxt.config.ts` (lines 305-319 -- head links and css array)
- Modify: `packages/app/assets/css/global.css` (complete rewrite)

**Context:** Replace Space Grotesk with Plus Jakarta Sans in the Google Fonts link. Import design tokens. Rewrite global.css to remove old token definitions and use the new shared tokens. The green theme-color meta tag also needs updating.

**Step 1: Run existing tests to confirm baseline**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: all tests pass

**Step 2: Update nuxt.config.ts**

In `packages/app/nuxt.config.ts`:

- Change the Google Fonts link (line ~314) from Space Grotesk to Plus Jakarta Sans:
  `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap`
- Change theme-color meta (line ~299) from `#0a0a0b` to `#fafaf9` (light mode default)
- Add `@portable/design-tokens/tokens.css` as the first entry in the `css` array (before `~/assets/css/global.css`)

**Step 3: Rewrite global.css**

Replace the entire contents of `packages/app/assets/css/global.css`. Remove all `:root` token definitions (they now come from the design-tokens package). Keep and update:

- Box-sizing reset (`*, *::before, *::after`)
- `html` -- font-size 16px, antialiased, text-size-adjust
- `body` -- `font-family: var(--font-sans)`, `background-color: var(--color-bg)`, `color: var(--color-text)`, `font-weight: 500`, line-height 1.6, min-height 100dvh
- `a` -- `color: var(--color-accent)`, no underline, `transition: color var(--transition-fast)`, hover: `var(--color-accent-hover)`
- `button` -- inherit font, cursor pointer, no border/bg/color
- `input, textarea, select` -- inherit font/size/color, no bg/border
- `h1-h6` -- `font-family: var(--font-sans)`, weight 600, line-height 1.2
- Page transition (same `.page-enter-active` / `.page-leave-active` fade)
- Scrollbar styling using new tokens (`--color-border`, `--color-text-muted`)

**Step 4: Run tests to verify no regressions**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: all tests still pass (tests use data-testid, not CSS)

**Step 5: Commit**

```bash
git add packages/app/nuxt.config.ts packages/app/assets/css/global.css
git commit -m "Switch main app to shared design tokens and Plus Jakarta Sans"
```

---

### Task 3: Redesign main app layout (topbar + bottom nav)

**Files:**

- Modify: `packages/app/layouts/default.vue`

**Depends on:** Task 2

**Context:** Restyle the layout to match the design spec. The structure (topbar, main content, bottom nav) stays the same, but the visual treatment changes entirely: new colors, new font, new nav behavior (icon color shift instead of background change), 60px bottom nav.

Read the design spec section "Top Bar" and "Bottom Navigation" for exact specs.

**Step 1: Run existing tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass

**Step 2: Restyle default.vue**

Rewrite the `<style scoped>` block in `packages/app/layouts/default.vue`. Keep the template structure and `data-testid` attributes intact. Key changes:

- **Topbar:** 56px, `var(--color-bg-surface)` background, `1px solid var(--color-border)` bottom border. Brand mark: `>_` in `var(--font-mono)` with `var(--color-accent)` color, "portable" in `var(--font-sans)` weight 600. No backdrop-filter blur.
- **Bottom nav:** 60px height, `var(--color-bg-surface)` background, `1px solid var(--color-border)` top border. Tabs use `var(--font-sans)` for labels (not mono). Active tab: `color: var(--color-accent)` on icon and label, no border-top indicator, no background change. Inactive: `var(--color-text-muted)`. Transition: `color var(--transition-fast)`.
- **Main content:** max-width 960px centered, padding using spacing tokens.
- Desktop (768px+): hide bottom nav as before.

**Step 3: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass

**Step 4: Commit**

```bash
git add packages/app/layouts/default.vue
git commit -m "Restyle main app layout with unified design tokens"
```

---

### Task 4: Redesign login page

**Files:**

- Modify: `packages/app/pages/login.vue`

**Depends on:** Task 2

**Context:** Strip the current terminal aesthetic (grid lines, glow orb, blink cursor) and replace with a minimal, typographic design with a subtle ambient indigo gradient. Read design spec "Login Page" section.

**Step 1: Rewrite login.vue styles**

Keep the template functional (GitHub OAuth link, error display), but simplify the markup and completely rewrite the styles:

- Remove: `.grid-lines`, `.glow-orb`, `pulse-glow` animation, `blink-cursor` animation
- Page: centered vertically and horizontally, `var(--color-bg)` background, full viewport
- Brand mark: `>_` in JetBrains Mono, `var(--color-accent)` color. "portable" in Plus Jakarta Sans 600 weight
- Tagline: "Claude Code, anywhere." in `var(--color-text-secondary)`, below brand mark
- Sign-in button: `var(--color-accent)` background, white text, `var(--radius-sm)` corners, 44px min height, max-width 320px
- Ambient life: a soft radial gradient using `var(--color-accent)` at 5% opacity, positioned behind the brand area, with a slow 18s CSS animation that drifts the gradient position. Use `@keyframes drift` with `background-position` shifts.
- Error message: `var(--color-danger)` border/tint, matching new tokens

**Step 2: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass (smoke test checks for "Portable" text which should still be present)

**Step 3: Commit**

```bash
git add packages/app/pages/login.vue
git commit -m "Redesign login page with minimal typographic style"
```

---

### Task 5: Redesign dashboard and ProjectCard

**Files:**

- Modify: `packages/app/pages/index.vue`
- Modify: `packages/app/components/ProjectCard.vue`

**Depends on:** Task 3

**Context:** Simplify the dashboard page and project cards. Cards get cleaner status indicators (dot + text instead of badges), simpler dropdown menus, and no bottom sheets. Read design spec "Dashboard" section.

**Step 1: Run existing tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass

**Step 2: Restyle index.vue (dashboard)**

Rewrite styles for the dashboard page:

- Page title: "Projects" in 700 weight, 20px. Remove the old subtitle with username.
- Project grid: single column mobile, `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))` for multi-column on wider screens, gap `var(--space-4)`.
- Loading/error/empty states: use new tokens for colors and spacing.
- "New project" button: `var(--color-accent)` background, white text, `var(--radius-sm)`.

**Step 3: Restyle ProjectCard.vue**

Major simplification of the component styles:

- Card: `var(--color-bg-surface)` background, `1px solid var(--color-border)`, `var(--radius-md)`, padding `var(--space-5)`. `box-shadow: var(--shadow-card)`.
- Project name: `var(--font-sans)` 600 weight 16px.
- Repo info: `var(--color-text-secondary)` 14px.
- Status indicator: Replace pill badges with a simple inline dot + text. Running: `var(--color-success)` dot + "Running" text. Stopped: `var(--color-text-muted)` dot + "Stopped". Starting/stopping: `var(--color-warning)` dot + text.
- Menu: "..." button opens a simple dropdown (keep the existing dropdown, restyle it with new tokens). Remove bottom sheets entirely.
- Action buttons: Clean styling with new tokens. Primary actions in accent color, danger actions in danger color.

Preserve all `data-testid` attributes and the component's behavioral logic (status transitions, menu toggling, sheet confirmations).

**Step 4: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass

**Step 5: Commit**

```bash
git add packages/app/pages/index.vue packages/app/components/ProjectCard.vue
git commit -m "Redesign dashboard and project cards with unified design"
```

---

### Task 6: Redesign settings page

**Files:**

- Modify: `packages/app/pages/settings.vue`

**Depends on:** Task 2

**Context:** Clean up settings page with new tokens. Add a theme toggle (System/Light/Dark segmented control). Read design spec "Settings Page" section.

**Step 1: Add theme toggle functionality**

Add a theme preference segmented control to the settings page. The theme toggle sets `data-theme` on `<html>` and persists the choice to `localStorage` (key: `portable-theme`, values: `"system"`, `"light"`, `"dark"`).

Implementation:

- Add a reactive `theme` ref initialized from `localStorage.getItem("portable-theme") || "system"`
- On change: set `localStorage`, update `document.documentElement.dataset.theme` (remove attribute for "system" to let CSS `prefers-color-scheme` take over, or set explicitly for "light"/"dark")
- Add a "Theme" section at the top of the settings page with a segmented control (three buttons in a row, the active one has `var(--color-accent)` background)

**Step 2: Restyle settings page**

Rewrite styles using new tokens:

- Section titles: `var(--color-text-secondary)`, 12px, uppercase, 0.04em letter-spacing
- Settings cards: `var(--color-bg-surface)`, `var(--color-border)`, `var(--radius-md)`, `box-shadow: var(--shadow-card)`
- Setting rows: flex between, 44px min height
- Credential input: `var(--font-mono)`, `var(--color-bg)` background
- Status badges: remove pill shape, use simple dot + text like ProjectCard
- Buttons: accent/danger colors from tokens

**Step 3: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass

**Step 4: Commit**

```bash
git add packages/app/pages/settings.vue
git commit -m "Redesign settings page and add theme toggle"
```

---

### Task 7: Redesign new project page

**Files:**

- Modify: `packages/app/pages/new.vue`

**Depends on:** Task 2

**Context:** Restyle the new project page with unified tokens. Read design spec "New Project Page" section.

**Step 1: Restyle new.vue**

Rewrite styles:

- Page title: "New Project" in 700 weight 20px
- Tabs: `var(--color-accent)` for active tab text + underline, `var(--color-text-secondary)` for inactive. `var(--font-sans)`.
- Scaffold/repo cards: `var(--color-bg-surface)`, `var(--color-border)`, `var(--radius-md)`. Selected: `border-color: var(--color-accent)`, `background: var(--color-accent-tint)`.
- Form inputs: `var(--color-bg-surface)`, `var(--color-border)`, `var(--radius-sm)`, focus ring using `box-shadow: 0 0 0 2px var(--color-accent-tint)`.
- Slug preview: `var(--font-mono)`, `var(--color-text-muted)`
- Create button: `var(--color-accent)` background, white text, `var(--radius-sm)`, full width on mobile
- Error banner: `var(--color-danger)` tint

**Step 2: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/app test`
Expected: pass

**Step 3: Commit**

```bash
git add packages/app/pages/new.vue
git commit -m "Redesign new project page with unified design"
```

---

## Phase 3: Editor SPA Redesign

### Task 8: Update editor infrastructure (tokens, fonts, App.vue shell) ∥

**Files:**

- Modify: `packages/editor/package.json` (add design-tokens dependency)
- Modify: `packages/editor/index.html` (add Google Fonts link)
- Modify: `packages/editor/src/main.ts` (import tokens CSS)
- Modify: `packages/editor/src/App.vue` (remove old tokens, restyle shell)

**Context:** Wire up the design tokens to the editor SPA. Add Google Fonts. Restyle the shell (tab bar). Remove the old `:root` variables from App.vue. Read design spec "Shell" and "Bottom Tab Bar" sections.

**Step 1: Run existing tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/editor test`
Expected: pass

**Step 2: Add design-tokens dependency**

Add to `packages/editor/package.json` devDependencies:

```json
"@portable/design-tokens": "workspace:*"
```

Run: `cd /home/finn/Repos/portable && bun install`

**Step 3: Add Google Fonts to index.html**

Add to `<head>` in `packages/editor/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
/>
```

**Step 4: Import tokens in main.ts**

Add to `packages/editor/src/main.ts` as first import:

```typescript
import "@portable/design-tokens/tokens.css";
```

**Step 5: Restyle App.vue**

In `packages/editor/src/App.vue`:

- Remove the entire global `<style>` block (lines 86-123) that defines `:root` variables, resets, and body styles. These now come from the tokens package.
- Add a smaller global `<style>` block with only:
  - `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`
  - `html, body { height: 100%; overflow: hidden; }`
  - `body { font-family: var(--font-sans); background: var(--color-bg); color: var(--color-text); font-weight: 500; -webkit-font-smoothing: antialiased; }`
  - `#app { height: 100dvh; }`

- Restyle the scoped `<style>` for the tab bar:
  - Tab bar: 60px height (up from 56px), `var(--color-bg-surface)` background, `1px solid var(--color-border)` top border
  - Tabs: `var(--font-sans)` for labels (not mono), `var(--color-text-muted)` default color
  - Active tab: `color: var(--color-accent)`, NO `border-top` indicator (remove the current 2px top border style)
  - Tab labels: 11px, `var(--font-sans)` weight 500
  - Touch targets: `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`

- Also initialize theme from localStorage on mount. Add to `<script setup>`:

  ```typescript
  import { onMounted } from "vue";

  onMounted(() => {
    const theme = localStorage.getItem("portable-theme");
    if (theme && theme !== "system") {
      document.documentElement.dataset.theme = theme;
    }
  });
  ```

**Step 6: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/editor test`
Expected: all tests pass (they use data-testid attributes, not CSS classes for styling)

**Step 7: Commit**

```bash
git add packages/editor/ packages/design-tokens/
git commit -m "Wire editor SPA to shared design tokens and restyle shell"
```

---

### Task 9: Redesign SessionList and ChatView structure

**Files:**

- Modify: `packages/editor/src/components/SessionList.vue`
- Modify: `packages/editor/src/views/ChatView.vue`

**Depends on:** Task 8

**Context:** Restyle the session list and chat view chrome (header, layout). Read design spec "Session List" and "Active Chat" header sections.

**Step 1: Restyle SessionList.vue**

Rewrite styles:

- Header: "Conversations" in `var(--font-sans)` 600 weight 18px (not uppercase mono). "+" button: 44px, `var(--color-accent)` background, white icon, `var(--radius-sm)`.
- Session rows: no card wrappers, just border-bottom separators using `var(--color-border-subtle)`. Title in `var(--color-text)` 15px, one line truncated. Time in `var(--color-text-muted)` on the right.
- Delete button: `var(--color-text-muted)` default, `var(--color-danger)` on press.
- Empty state: `var(--color-text-secondary)`, centered. Button: accent-colored border style.
- 44px minimum row height.

Preserve all `data-testid` attributes.

**Step 2: Restyle ChatView.vue**

Restyle the chat view chrome:

- Chat header: back arrow + session title centered in `var(--font-sans)` 15px 600 weight. Height 52px. Border-bottom `var(--color-border-subtle)`.
- Message list: padding `var(--space-4)` horizontal, `var(--space-5)` vertical gap between messages.
- Keep the streaming indicator but restyle: three pulsing dots in `var(--color-text-muted)`.

Preserve all `data-testid` attributes and behavioral logic.

**Step 3: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/editor test`
Expected: pass

**Step 4: Commit**

```bash
git add packages/editor/src/components/SessionList.vue packages/editor/src/views/ChatView.vue
git commit -m "Redesign session list and chat view layout"
```

---

### Task 10: Redesign ChatMessage and ChatInput

**Files:**

- Modify: `packages/editor/src/components/ChatMessage.vue`
- Modify: `packages/editor/src/components/ChatInput.vue`

**Depends on:** Task 8

**Context:** Major visual change for messages: user messages become right-aligned pills with accent tint, assistant messages become full-width with no container. Tool use blocks collapse into a "N tools used" disclosure. Read design spec "Active Chat" and "Chat Input" sections.

**Step 1: Restyle ChatMessage.vue**

Rewrite the message component styles:

- **User messages:** `margin-left: auto`, `max-width: 80%`, `background: var(--color-accent-tint)`, `border-radius: var(--radius-sm)`, padding `var(--space-3) var(--space-4)`. No border. Text: `var(--color-text)` 15px `var(--font-sans)`.
- **Assistant messages:** Full width, no background, no border, no margin. Text: `var(--color-text)` 15px `var(--font-sans)`, `white-space: pre-wrap`.
- **Code blocks in assistant messages:** `var(--color-bg-surface)` background, `var(--radius-sm)`, `var(--font-mono)` 13px, padding `var(--space-4)`. Add a top bar with language name in `var(--color-text-muted)` 12px and a copy button.
- **Tool use:** Change from expandable blocks to a collapsed disclosure line: "N tools used" in `var(--color-text-muted)` 13px with a disclosure triangle. Clicking expands to show the list of tool names. The tool-use-header button and tool-use-input pre need restyling.

Preserve `data-testid="chat-message"`, `data-testid="tool-use-block"`, and the `.message-user` / `.message-assistant` classes (tests check these).

**Step 2: Restyle ChatInput.vue**

Rewrite input styles:

- Container: `var(--color-bg-surface)` background, `var(--radius-md)`, padding `var(--space-3)`, margin `var(--space-3)`. `box-shadow: var(--shadow-card)`.
- Textarea: `var(--font-sans)` 15px, weight 500, placeholder "Message Claude..." in `var(--color-text-muted)`. No visible border, transparent background. Max height ~120px.
- Send button: 40px circle, `var(--color-accent)` background, white arrow icon. Only visible when there's text.
- Interrupt button: same 40px circle, `var(--color-danger)` background, white square icon.
- Bottom safe area padding.

Preserve `data-testid="send-button"` and `data-testid="interrupt-button"`.

**Step 3: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/editor test`
Expected: pass

**Step 4: Commit**

```bash
git add packages/editor/src/components/ChatMessage.vue packages/editor/src/components/ChatInput.vue
git commit -m "Redesign chat messages and input with unified design"
```

---

### Task 11: Redesign FileTree and CodeViewer

**Files:**

- Modify: `packages/editor/src/components/FileTree.vue`
- Modify: `packages/editor/src/components/CodeViewer.vue`
- Modify: `packages/editor/src/views/FilesView.vue`

**Depends on:** Task 8

**Context:** Restyle file browsing components. CodeMirror needs a custom theme that adapts to light/dark via CSS variables. Read design spec "File Tree", "Code Viewer", and "Responsive" sections.

**Step 1: Restyle FileTree.vue**

Rewrite styles:

- Header area: "Files" title in `var(--font-sans)` 600 weight 18px, refresh button in `var(--color-text-muted)`.
- Tree nodes: 44px row height, 20px indent per level, vertical guide lines in `var(--color-border-subtle)`.
- Directory names: `var(--font-sans)` 500 weight 14px. Chevron rotates on expand.
- File names: `var(--font-sans)` 400 weight 14px, extension in `var(--color-text-muted)`.
- Hover/press: `var(--color-bg-surface)` background.

**Step 2: Restyle CodeViewer.vue**

Rewrite styles and update CodeMirror theme:

- Header: 44px, `var(--color-bg-surface)` background, border-bottom. Back button with `var(--color-accent)`. Filename centered in `var(--font-mono)` 13px. Edit/Save button on right.
- Replace the current `oneDark` + custom theme with a single custom theme that reads CSS variables:
  - Root: `backgroundColor: var(--color-bg)`, `color: var(--color-text)`
  - Gutters: `backgroundColor: var(--color-bg-surface)`, `color: var(--color-text-muted)`
  - Cursor: `borderLeftColor: var(--color-accent)`
  - Selection: `var(--color-accent-tint)`
  - For syntax highlighting: create a `HighlightStyle` using indigo for keywords, muted tones for strings/comments/numbers. These should use fixed colors (not CSS variables) because CodeMirror's highlight system doesn't support CSS variables. Define two sets (light and dark) and switch based on the theme. Or use a single set of colors that work reasonably well in both modes.
- Remove the `@codemirror/theme-one-dark` import and dependency.

**Step 3: Restyle FilesView.vue**

Update the container view to use new tokens for loading/error states.

**Step 4: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/editor test`
Expected: pass

**Step 5: Commit**

```bash
git add packages/editor/src/components/FileTree.vue packages/editor/src/components/CodeViewer.vue packages/editor/src/views/FilesView.vue
git commit -m "Redesign file browser and code viewer with custom CodeMirror theme"
```

---

### Task 12: Redesign GitView and PreviewView

**Files:**

- Modify: `packages/editor/src/views/GitView.vue`
- Modify: `packages/editor/src/views/PreviewView.vue`

**Depends on:** Task 8

**Context:** Restyle the git and preview views. Read design spec "Git View" and "Preview View" sections.

**Step 1: Restyle GitView.vue**

Rewrite styles:

- Header: "Git" title + refresh button, matching FileTree header style.
- Branch section: branch icon + name in `var(--font-mono)` 14px, `var(--color-accent)`.
- Section headings: "STAGED" / "UNSTAGED" in 12px uppercase, `var(--color-text-secondary)`, 0.04em letter-spacing.
- File rows: status letter color-coded (`var(--color-success)` for staged, `var(--color-warning)` for unstaged), file path in `var(--font-mono)` 13px. 44px row height.
- Commit rows: short hash in `var(--font-mono)` `var(--color-text-muted)`, message in `var(--color-text)` 14px truncated, relative time in `var(--color-text-muted)`. Border separators.
- Empty state: "Clean working tree" centered in `var(--color-text-muted)`.
- Remove author display from commit rows (single-user tool).

**Step 2: Restyle PreviewView.vue**

Rewrite styles:

- Header: 40px, `var(--color-bg-surface)` background, border-bottom. "Preview" label in `var(--font-sans)` 13px 500 weight. URL in `var(--font-mono)` 12px `var(--color-text-muted)`. Icon buttons 28px in `var(--color-text-muted)`.
- Loading: centered spinner using `var(--color-accent)`.
- Iframe: full bleed, no border. Background `var(--color-bg)`.

**Step 3: Run tests**

Run: `cd /home/finn/Repos/portable && bun run --filter @portable/editor test`
Expected: pass

**Step 4: Commit**

```bash
git add packages/editor/src/views/GitView.vue packages/editor/src/views/PreviewView.vue
git commit -m "Redesign git and preview views with unified design"
```

---

## Phase 4: Integration and Polish

### Task 13: Add theme initialization to main app

**Files:**

- Modify: `packages/app/app.vue` (or `packages/app/layouts/default.vue`)
- Modify: `packages/app/pages/login.vue`

**Depends on:** Task 6 (settings page has the theme toggle)

**Context:** The main app needs to read the theme preference on load and set `data-theme` on `<html>`. The login page uses `layout: false` so it needs its own initialization too.

**Step 1: Add theme init to the default layout**

In `packages/app/layouts/default.vue`, add to `<script setup>`:

```typescript
import { onMounted } from "vue";

onMounted(() => {
  const theme = localStorage.getItem("portable-theme");
  if (theme && theme !== "system") {
    document.documentElement.dataset.theme = theme;
  }
});
```

**Step 2: Add theme init to login page**

Same logic in `packages/app/pages/login.vue` `<script setup>` since it uses `layout: false`.

**Step 3: Commit**

```bash
git add packages/app/layouts/default.vue packages/app/pages/login.vue
git commit -m "Initialize theme preference on app load"
```

---

### Task 14: Final test sweep and cleanup

**Depends on:** All previous tasks

**Step 1: Run all tests across the monorepo**

Run: `cd /home/finn/Repos/portable && bun run test`
Expected: all pass

**Step 2: Run linting**

Run: `cd /home/finn/Repos/portable && bun run lint:fix`

**Step 3: Run formatting**

Run: `cd /home/finn/Repos/portable && bun run format`

**Step 4: Run typecheck**

Run: `cd /home/finn/Repos/portable && bun run typecheck`

**Step 5: Fix any issues found**

Address any lint, format, or type errors.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "Fix lint and formatting issues from design system migration"
```

---

## Task Dependency Graph

```
Phase 1:  [Task 1] ─────────────────────────────────────────────────┐
                                                                      │
Phase 2:  [Task 2] ──┬── [Task 3] ── [Task 5]                       │
                      ├── [Task 4]                                    │
                      ├── [Task 6] ── [Task 13]                      │
                      └── [Task 7]                                    │
                                                                      │
Phase 3:  [Task 8] ──┬── [Task 9]                                    │
                      ├── [Task 10]                                   │
                      ├── [Task 11]                                   │
                      └── [Task 12]                                   │
                                                                      │
Phase 4:  [Task 14] ◄────────────────────────────────────────────────┘
```

**Parallelizable tasks (marked ∥):**

- Task 1 is standalone
- After Task 1: Task 2 and Task 8 can run in parallel (different packages)
- After Task 2: Tasks 4, 6, 7 can run in parallel
- After Task 8: Tasks 9, 10, 11, 12 can run in parallel
- Task 3 depends on Task 2; Task 5 depends on Task 3
- Task 13 depends on Task 6
- Task 14 depends on everything
