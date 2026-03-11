# Portable v2 Frontend Design

## Design Vision

A warm, professional, inviting experience that feels like a polished consumer product -- not a developer tool. Simple to use, elegant in its simplicity, but powerful and well thought out. Targets non-techies while remaining capable for power users.

The editor SPA is eliminated as a separate package. All UI lives in the Nuxt main app. Project pods become pure API backends. Only the preview iframe still needs a subdomain.

---

## Visual Language

### Personality

Warm and inviting but grounded. Professional polish, not whimsy. A productivity tool that happens to look great.

### Color Palette

**Light mode:**

- Background: warm stone (think `#f5f3f0` range)
- Surface (cards, panels): white
- Text: warm dark tones, three tiers (primary, secondary, muted)
- Border: warm gray
- Accent: burnished orange (think `#e07a3a` range)
- Accent tint: pale warm orange for backgrounds
- Danger: warm red
- Success: warm green

**Dark mode:**

- Background: deep warm charcoal
- Surface: slightly lifted warm dark
- Text: warm light tones, three tiers
- Border: warm dark gray
- Accent: shifts toward amber-gold (think `#e8a455` range) -- feels premium and cozy on dark surfaces
- Accent tint: deep warm amber for backgrounds
- Danger/success: same hues, adjusted for contrast on dark

### Typography

- Sans-serif: Plus Jakarta Sans -- warm, readable, friendly without being childish
- Monospace: JetBrains Mono -- proven for code
- Body: ~15px, generous line-height (1.6 for body, 1.4 for headings)
- Headings scale proportionally, medium/semibold weight

### Shape & Spacing

- Border radius: generous but not bubbly -- 12px for cards/panels, 8px for buttons/inputs, 20px for pills/badges
- Spacing scale: 4/8/12/16/24/32/48/64px
- Touch targets: minimum 44px for all interactive elements
- Cards: subtle warm shadow in light mode, border-only in dark mode

### Motion

- 150ms for micro-interactions (hover, focus)
- 250ms for state changes (expand/collapse, toggles)
- 350ms for page/view transitions
- Easing: ease-out for entering, ease-in for exiting
- No gratuitous animation -- motion serves comprehension only

---

## Information Architecture

### App Shell

Top bar always visible:

- **Left**: "Portable" wordmark
- **Right**: "+" icon (new project), user avatar (opens settings)

The "+" icon is hidden/disabled until both API key and AGE key are configured.

### Routes

| Route                     | View          | Description                               |
| ------------------------- | ------------- | ----------------------------------------- |
| `/`                       | Dashboard     | Project list                              |
| `/login`                  | Login         | GitHub OAuth sign-in                      |
| `/onboarding`             | Onboarding    | First-time key setup wizard               |
| `/settings`               | Settings      | Theme, credentials, logout                |
| `/projects/new`           | New Project   | Scaffold or import                        |
| `/projects/:slug`         | Project Shell | Loading screen or editor with bottom tabs |
| `/projects/:slug/chat`    | Chat          | Session list or active conversation       |
| `/projects/:slug/files`   | Files         | File tree or code viewer                  |
| `/projects/:slug/git`     | Git           | Branch, changes, history, diff viewer     |
| `/projects/:slug/preview` | Preview       | Dev server iframe                         |

### Navigation Flow

1. User signs in via GitHub OAuth
2. If keys not configured: redirect to onboarding
3. Dashboard shows project list
4. Tap a running project: navigate to `/projects/:slug` which shows the editor
5. Tap a stopped project: navigate to `/projects/:slug` which shows the status/loading screen with a Start button
6. Settings accessed via user avatar in top bar
7. New project via "+" icon in top bar

---

## Screens

### Login

- Centered card on warm background
- "Sign in with GitHub" button
- Brief tagline about what Portable is

### Onboarding (first-time setup)

Three-step wizard, only shown when keys are missing:

**Step 1: Welcome**

- Greeting with GitHub display name
- One-liner about Portable
- "Let's get you set up" CTA

**Step 2: Anthropic API Key**

- Explanation of why it's needed
- Two paths:
  - OAuth token: instructions to run `claude setup-token`, paste result
  - API key: link to console.anthropic.com, paste key
- Input field + save button
- Inline success confirmation

**Step 3: AGE Key**

- Explanation of why it's needed
- Copy-able terminal commands:
  - `age-keygen -o key.txt`
  - `cat key.txt`
  - Reminder to store key.txt safely
- Input field for private key + save button
- Inline success confirmation

**Step 4: Done**

- "You're all set" confirmation
- Button to go to dashboard

### Dashboard

- Project cards in a single column on mobile, auto-grid on wider screens
- Each card is visually lightweight:
  - Project name
  - Small colored status dot + label (Running, Stopped, Starting, Error)
  - Three-dot menu: Start/Stop, Rename, Delete, Open GitHub repo
- Tap a running project to open it (navigates to editor)
- Tap a non-running project to see the project status screen
- During transitional states: status area shows phase text with animation

**Empty state:**

- Friendly icon/illustration
- "No projects yet"
- Prominent "Create your first project" button

**Delete confirmation:**

- Modal/inline confirmation
- Option to also delete the GitHub repository
- Destructive action in red

**Rename:**

- Small modal with name input

### New Project

Two modes via clean tabs or toggle:

**From Scaffold:**

- Template cards (name + description), selectable
- Name input
- Create button

**Import Repo:**

- Search field to filter
- Repo list: name, private badge, language, description
- Select to highlight
- Name input (pre-filled from repo name)
- Import button

On success: redirect to `/projects/:slug` where the loading screen shows creation progress, then auto-starts the project.

### Project Loading / Status Screen

Gateway into the editor. Shown at `/projects/:slug` when the project isn't ready.

**Starting up (after creation or manual start):**

- Project name prominently displayed
- Sequential progress phases shown as a checklist:
  - Creating database...
  - Creating repository... / Preparing workspace...
  - Launching container...
  - Cloning repository...
  - Installing dependencies...
  - Starting server...
- Current phase: spinner/animation
- Completed phases: checkmark
- Once "ready": auto-transition to editor with smooth crossfade

**Stopped:**

- Project name
- "This project is stopped" message
- Prominent "Start" button
- Back to dashboard link

**Error:**

- Project name
- Error message
- "Try starting again" button
- Back to dashboard link

### Settings

Accessed via user avatar in top bar.

- **User**: GitHub username (read-only), logout button
- **Theme**: System / Light / Dark toggle
- **Anthropic credential**: status (configured/not), save/remove, same UX as onboarding step
- **AGE key**: same pattern
- Inline success/error feedback on all actions

---

## Editor (Project View)

When a project is running, `/projects/:slug` shows the editor with a bottom tab bar.

### Shell

- Top bar: back arrow (to dashboard), project name centered, status pill
- Bottom tab bar: Chat, Files, Git, Preview (4 tabs with icons)
- Active tab highlighted with accent color

### Chat Tab

**Session list (default):**

- Past conversations sorted most recent first
- Each entry: session title + relative time
- Tap to open conversation
- Delete via swipe or long-press
- "New conversation" button prominently placed
- Pulsing indicator on sessions with active background queries
- Empty state: prompt to start a conversation

**Active conversation:**

- Back arrow to return to session list
- Scrollable message thread:
  - **User messages**: right-aligned bubbles with accent-tint background
  - **Assistant messages**: full-width, left-aligned, full markdown rendering:
    - Headings, bold/italic, lists, links, blockquotes
    - Code blocks with syntax highlighting
    - Tables in horizontally scrollable containers
    - Inline code
  - **Tool use**: inline in assistant flow, visually recessed -- smaller text, muted colors, reduced contrast. Shows tool name + brief summary. Always visible but secondary.
  - **Thinking blocks**: collapsible single line "Thought for Xs". Tap to expand, content styled dimmed/muted.
  - **Result metadata**: small subtle footer per assistant turn -- turns, duration, cost
  - **Tool progress**: animated line "Running {tool_name}..." below streaming text while tools execute
  - **Subagent activity**: task started/progress/completion shown inline (from SDK system messages)
- **Streaming**: text appears incrementally via stream_event deltas
- Auto-scroll to bottom on new content
- Streaming indicator while waiting

**Input area:**

- Auto-growing textarea pinned to bottom
- Send button (accent colored)
- Interrupt button replaces send during active query
- Enter to send, Shift+Enter for newline

**Background query support:**

- Queries continue running on pod when user navigates away
- Reconnecting replays buffered events
- Session list shows which sessions have active queries

### Files Tab

**File tree (default):**

- Hierarchical directory listing
- Directories before files, alphabetical
- Expand/collapse with smooth animation
- File-type icons (VS Code style if a lightweight library is available, otherwise simple monochrome by extension)
- Tap file to open in viewer
- Indent guides for nesting
- Loading skeleton

**Code viewer:**

- Top bar: filename, back button, edit toggle
- CodeMirror 6 with syntax highlighting (JS, TS, JSX, TSX, JSON, CSS, SCSS, HTML, Vue, Markdown)
- Theme-aware highlighting matching the app palette
- Read-only by default, edit toggle enables editing
- Save button in edit mode, writes via API
- Success/error feedback on save

### Git Tab

- Current branch name at top
- **Staged changes**: file list with status badges (modified, added, deleted, renamed, copied, untracked)
- **Unstaged changes**: same format
- "Clean working tree" message when empty
- **Tapping a changed file**: opens a diff view showing added/removed lines (new endpoint: `GET /api/git/diff/:path`)
- Toggle/link to switch from diff to full file view in Files tab
- **Commit history**: scrollable list -- short hash, message, author, relative time
- Loading skeleton, error state with retry

### Preview Tab

- Full-height iframe loading dev server via preview subdomain
- **White background on iframe container** (prevents transparent bleed-through)
- Thin header: "Preview" label, URL, refresh button, open-in-new-tab button
- Loading overlay while iframe loads

---

## Backend Changes Required

### Architecture Shift: Editor into Main App

The `packages/editor` SPA is retired. All editor UI becomes Nuxt pages/components in `packages/app`. The pod-server no longer serves the editor -- it becomes a pure API/WebSocket backend.

**Implications:**

- Auth relay flow for editor subdomains is eliminated
- Editor subdomain routing (`<slug>--portable.example.com`) removed
- Only preview subdomain remains (`<slug>--preview.example.com`)
- Main app proxies API calls to pod-server (already does this)
- Shared auth, navigation, theme -- everything is one app
- Pod-server image no longer needs the editor build

### Pod-Server Changes (from background-queries plan)

**New: `session-manager.ts`**

- Module-level singleton managing background sessions
- Sessions persist queries independent of WebSocket connections
- Event buffering for reconnection replay
- Cleanup timer for abandoned sessions

**Rewrite: `ws.ts`**

- Thin bridge delegating to session manager
- On connect: attach to existing session or create new
- On disconnect: detach without killing query
- Replay protocol: `replay_start` -> buffered events -> `replay_end`

**New: `GET /api/sessions/active`**

- Returns SDK session IDs with running queries

**Update: `sessions.ts`**

- Extract thinking blocks from session history alongside text and tool_use

**New: `GET /api/git/diff/:path`**

- Returns diff output for a specific file (for Git tab diff view)

### Main App Changes

**New pages:**

- `/onboarding` -- key setup wizard
- `/projects/[slug].vue` -- project shell (loading screen + editor)
- `/projects/[slug]/chat.vue`, `files.vue`, `git.vue`, `preview.vue` -- editor tabs

**New components (migrated and redesigned from editor):**

- Chat: SessionList, ChatMessage, ChatInput
- Files: FileTree, CodeViewer
- Git: GitStatus, DiffViewer (new)
- Preview: PreviewFrame

**New composables (migrated from editor):**

- useWebSocket (rewritten for streaming + replay + background queries)
- useSessions (with active session polling)
- useFiles
- useGit

**Modified:**

- Layout/navigation for the two-context model (dashboard vs project)
- Subdomain proxy simplified (only preview subdomain)
- Auth middleware (onboarding redirect when keys missing)
- Design tokens completely rebuilt

**Removed/retired:**

- `packages/editor` -- entire package (functionality moves to main app)
- Auth relay flow (no longer needed)
- Editor subdomain routing

---

## Cross-Cutting Concerns

### Theme System

- System / Light / Dark, persisted to localStorage
- `[data-theme]` attribute on `<html>`
- All components use CSS custom properties from design tokens
- Theme shared across all views (no cross-domain issue since editor is now part of the app)

### Error Handling

- All API calls surface errors inline
- Loading skeletons on async operations
- Retry on fetch failures
- Form validation prevents invalid submissions

### Real-Time Updates

- Streaming chat via WebSocket with incremental text deltas
- Background query persistence -- queries survive navigation
- Polling for project status during transitions
- Auto-reconnect on WebSocket disconnect with event replay

### State Sharing

- File state shared between Files and Git views
- Git diff view can navigate to full file in Files view
- Session state persists across navigation within a project
