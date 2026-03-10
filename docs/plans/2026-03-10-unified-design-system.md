# Unified Design System for Portable

## Overview

A unified visual language for both the main app (Nuxt) and the editor SPA (Vue), replacing the current split personality (terminal/hacker main app vs GitHub-dark editor). The design is clean, calm, inviting, distraction-free, and professional.

## Design Foundations

### Color Palette -- Dark Mode

| Token                    | Value     | Usage                     |
| ------------------------ | --------- | ------------------------- |
| `--color-bg`             | `#16161a` | Page background           |
| `--color-bg-surface`     | `#1e1e24` | Cards, nav bars, inputs   |
| `--color-bg-elevated`    | `#26262e` | Dropdowns, modals, hovers |
| `--color-border`         | `#2e2e38` | Default borders           |
| `--color-border-subtle`  | `#24242c` | Lighter separators        |
| `--color-text`           | `#ececf0` | Primary text              |
| `--color-text-secondary` | `#9090a0` | Secondary text            |
| `--color-text-muted`     | `#5c5c6a` | Muted text, placeholders  |

### Color Palette -- Light Mode

| Token                    | Value     | Usage                     |
| ------------------------ | --------- | ------------------------- |
| `--color-bg`             | `#fafaf9` | Page background           |
| `--color-bg-surface`     | `#ffffff` | Cards, nav bars, inputs   |
| `--color-bg-elevated`    | `#f0f0ee` | Dropdowns, modals, hovers |
| `--color-border`         | `#e2e2de` | Default borders           |
| `--color-border-subtle`  | `#ebebea` | Lighter separators        |
| `--color-text`           | `#1a1a22` | Primary text              |
| `--color-text-secondary` | `#6e6e7a` | Secondary text            |
| `--color-text-muted`     | `#a0a0aa` | Muted text, placeholders  |

### Accent and Semantic Colors

| Token                  | Value                                                        | Usage                        |
| ---------------------- | ------------------------------------------------------------ | ---------------------------- |
| `--color-accent`       | `#6366F1`                                                    | Primary actions, active tab  |
| `--color-accent-hover` | `#818CF8`                                                    | Hover state                  |
| `--color-accent-tint`  | `rgba(99,102,241,0.08)` light / `rgba(99,102,241,0.15)` dark | Backgrounds, user messages   |
| `--color-danger`       | `#EF4444`                                                    | Destructive actions          |
| `--color-danger-hover` | `#F87171`                                                    | Destructive hover            |
| `--color-success`      | `#22C55E`                                                    | Running status, staged files |
| `--color-warning`      | `#EAB308`                                                    | Unstaged files               |

### Typography

- **UI font (`--font-sans`):** Plus Jakarta Sans (weights 500, 600, 700). Loaded from Google Fonts.
- **Code font (`--font-mono`):** JetBrains Mono (weights 400, 500). Loaded from Google Fonts.
- **Base size:** 15px on mobile, 14px on desktop.
- **Type scale:** Section headings use 600 weight. Page titles use 700 weight at 18-20px. Body text uses 500 weight. Small labels (section sub-headings, timestamps) use 12-13px in text-secondary or text-muted, uppercase with 0.04em letter-spacing.

### Spacing

4px base unit. Named tokens:

| Token       | Value |
| ----------- | ----- |
| `--space-1` | 4px   |
| `--space-2` | 8px   |
| `--space-3` | 12px  |
| `--space-4` | 16px  |
| `--space-5` | 24px  |
| `--space-6` | 32px  |
| `--space-7` | 48px  |
| `--space-8` | 64px  |

Generous padding: cards get 16-20px, page margins 20-24px on mobile.

### Border Radii

| Token         | Value | Usage                        |
| ------------- | ----- | ---------------------------- |
| `--radius-sm` | 8px   | Buttons, inputs, small cards |
| `--radius-md` | 12px  | Project cards, modals        |
| `--radius-lg` | 16px  | Bottom sheets                |

### Shadows (light mode only)

- Cards: `0 1px 3px rgba(0,0,0,0.06)`
- Elevated: `0 8px 24px rgba(0,0,0,0.08)`
- Dark mode uses border differentiation instead of shadows.

### Interaction

- **Touch targets:** 44px minimum (`--touch-min`), enforced everywhere.
- **Transitions:** `--transition-fast: 150ms ease` (micro-interactions), `--transition-base: 250ms ease` (layout shifts, modals).
- No hover lift effects. Clean state changes via color/opacity.

---

## Theme System

### Implementation

CSS custom properties at `:root`, overridden by `[data-theme="dark"]` and `[data-theme="light"]` selectors on `<html>`.

On load:

1. Read user's stored theme preference from settings API.
2. Fall back to `prefers-color-scheme` media query.
3. Set `data-theme` attribute on `<html>`.

### Shared Tokens Package

A `packages/design-tokens` package (or similar) exports a single CSS file containing all token definitions for both themes. Both the main app and editor import this file. No component library -- just tokens.

### CodeMirror Theme

A custom CodeMirror theme that reads from the CSS custom properties, automatically adapting to light/dark. Replaces the hardcoded One Dark theme. Uses warm grays, indigo for keywords, and complementary muted tones for strings, comments, etc.

---

## Main App

### Login Page

Centered vertically and horizontally. No card container -- content floats directly on the background.

- **Brand mark:** "portable" in Plus Jakarta Sans 600 weight, normal size. Prefixed with `>_` in JetBrains Mono, indigo color.
- **Tagline:** Below the brand mark, a single line in text-secondary: "Claude Code, anywhere."
- **Sign-in button:** Below the tagline, generous spacing. "Sign in with GitHub" in accent color, full-width on mobile (max-width ~320px).
- **Ambient life:** Behind the brand mark area, a very soft radial gradient in indigo at 4-6% opacity, slowly drifting on a 15-20 second CSS animation cycle. Not pulsing, not glowing -- a quiet warm presence like light through frosted glass. Barely noticeable but the page feels alive.

### Top Bar

56px height. Brand mark on the left (`>_ portable` in small JetBrains Mono, indigo on the `>_`). Page-specific title if applicable (e.g., "Settings"). Clean, minimal.

### Bottom Navigation

Three tabs: Projects (grid icon), New (plus icon), Settings (gear icon).

- 60px height.
- Icons only on narrow mobile, icons + small labels on wider screens.
- Active tab: icon fills with indigo color. No borders, no background pills -- just a color shift with a smooth transition.

### Dashboard

Page title "Projects" in Plus Jakarta Sans 600. Below, a grid of project cards.

- Single column on mobile, two columns on tablet+.
- Each card: surface-colored container, 12px radius, generous padding.
  - Project name in 600 weight.
  - Repo info in text-secondary below.
  - Status: small dot (green for running, gray for stopped) next to a text label. No badges, no pills.
  - "..." menu button in top-right corner for actions (start, stop, delete), opening a simple dropdown.

### Settings Page

Clean sections with headings in text-secondary, 12-13px, uppercase, letterspaced.

- Setting rows: full-width, label on left, value/control on right.
- **Theme toggle:** Segmented control with System / Light / Dark options.
- **API key input:** JetBrains Mono with a show/hide toggle.

### New Project Page

Tabbed layout (Scaffold / Import). Active tab indicated by indigo color and underline.

- Scaffold selection: card grid, selected card gets indigo border and accent-tint background.
- Import: repository list from GitHub, searchable.

---

## Editor SPA

### Shell

Full viewport height (`100dvh`). Vertical flex: content area fills space, bottom tab bar fixed at bottom.

- **No top bar in the shell itself.** Each view manages its own header area. This maximizes vertical space.
- **Back to main app:** A small back arrow in the top-left of whichever view's header is active. Full page navigation back to the dashboard.

### Bottom Tab Bar

Four tabs: Chat (message bubble icon), Files (folder icon), Git (branch icon), Preview (eye icon).

- Same 60px height and indigo color-shift styling as the main app's nav.
- Instant tab switching, no animated transitions. State preserved across tabs.

### Responsive Behavior

- **Mobile:** Each tab is a full-screen view.
- **Tablet+ (progressive enhancement):** Chat and Files views can use sidebar layouts (session list or file tree on left, content on right). Tab bar remains.

---

## Chat View

### Session List (default state)

Header: "Conversations" in 600 weight, "+" button (indigo, 44px touch target).

Session rows: title in primary text (one line, truncated), relative time in text-muted on the right. Thin border separators between rows, no card wrappers. Tapping opens the chat. Swipe-left to reveal delete, or a small trash icon per row.

Empty state: "No conversations yet" centered in text-secondary, with a "Start a conversation" button below in indigo.

### Active Chat

**Header:** Back arrow (returns to session list), session title centered in 15px 600 weight (or "New conversation"). No other chrome.

**Messages:** Generous vertical spacing (16-20px between turns).

- **User messages:** Right-aligned, compact pill with accent-tint background, 8px radius, max-width ~80%. Text in primary color, 15px. No "You" label.
- **Assistant messages:** Full-width, left-aligned, no container or background. Text in primary color, 15px. Code blocks get surface-colored background, 8px radius, JetBrains Mono, with a subtle top bar showing language name and copy button. 16px internal padding.

### Tool Call Activity (Live Ticker)

**While Claude is working:**

A compact activity area appears above the streaming indicator. It has a subtle 2px left border in indigo to visually group it.

- Each active tool call shows as a single line: a small spinner icon (indigo) + human-readable label in text-secondary, JetBrains Mono 13px. Examples: "Reading src/index.ts", "Running bun test", "Editing 3 files".
- Multiple concurrent tools stack vertically.
- When a tool completes: spinner becomes a checkmark, lingers ~1 second, then fades out.

**After the response is complete:**

All tool activity collapses into a single disclosure line within the message: a disclosure triangle + "7 tools used" in text-muted, 13px. Tapping expands a list of what was called. Most users will never open this.

### Streaming Indicator

Below the tool activity area, a simple pulsing ellipsis "..." in text-muted.

### Chat Input

Fixed at bottom, above the tab bar. Surface-colored container, 12px radius, 12px padding.

- Auto-growing textarea (max ~120px height), Plus Jakarta Sans 15px, placeholder "Message Claude..." in text-muted.
- Send button: 40px circle, arrow icon, indigo background. Only appears when there's text.
- During streaming: send button replaced by a stop/square icon in danger color to interrupt.

---

## Files View

### File Tree

Header: "Files" title + refresh button.

- Indented tree list.
- Directories: chevron icon (rotates on toggle) + folder name in 600 weight.
- Files: filename in 400 weight, extension dimmed in text-muted.
- 20px indent per depth level, thin vertical guide line in border color per nesting level.
- 44px row height, full-width tap target. Surface-colored background on press/hover.
- Common directories excluded: `node_modules`, `.git`, `.nuxt`, `.output`, `dist`, `coverage`.

### Code Viewer

Full-screen push from file tree.

**Header:** Back arrow, filename centered (JetBrains Mono 13px, truncated), "Edit" button on right.

- **Read-only (default):** Clean CodeMirror view with line numbers in text-muted and custom syntax highlighting matched to the design system palette.
- **Edit mode:** Tapping "Edit" makes it editable, button becomes "Save" in indigo. Subtle header tint to indicate edit state. Save calls file write API, returns to read-only.

### Responsive (tablet+)

Side-by-side layout: 260px file tree sidebar on left with right border separator, code viewer filling the rest. Selecting a file updates the right panel without navigation transition.

---

## Git View

Header: "Git" title + refresh button. Scrollable page with three sections.

### Branch

Compact row: branch icon + branch name in JetBrains Mono 14px, indigo color. Informational only.

### Changes

Section sub-headings: "STAGED" / "UNSTAGED" in 12px uppercase text-secondary.

- Each file row: status letter (M/A/D/U) color-coded (green for staged, amber for unstaged) + file path in JetBrains Mono 13px.
- Tapping a file navigates to it in the Files view.
- Empty state: "Clean working tree" centered in text-muted.

### Commits

List of recent commits. Each row: short hash in JetBrains Mono text-muted, commit message in primary text (one line, truncated), relative time on the right in text-muted. No author shown (single-user tool). Thin border separators.

---

## Preview View

Thin header bar (40px): "Preview" label on left, preview URL truncated in JetBrains Mono 12px text-muted in center, refresh + open-in-new-tab buttons on right.

Full-bleed iframe fills all remaining space. Centered indigo spinner while loading. No other chrome -- the frame disappears and you see your app.

If the dev server isn't running yet: centered "Dev server starting..." with setup phase text below in text-muted.

---

## Design Principles Summary

1. **One house, two rooms.** Main app and editor are separate navigation contexts but share identical visual foundations (tokens, typography, colors, spacing).
2. **Content over chrome.** Minimize UI elements. Whitespace is a feature.
3. **Familiar, not generic.** Warm indigo accent + Plus Jakarta Sans give Portable a recognizable identity without being flashy.
4. **Mobile-first, desktop-aware.** Everything works at 320px. Wider screens get progressive enhancements (sidebars, multi-column grids).
5. **Calm feedback.** Tool calls stream as quiet activity indicators, then collapse. Status uses dots and words, not animated badges. The UI stays out of the way.
