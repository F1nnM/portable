# Conversation Management Design

## Overview

Add conversation history and parallel conversation support to Portable, leveraging the Claude Agent SDK's built-in session management. Users can list past conversations, resume any session, start new ones, and delete old ones — mirroring Claude Code CLI's conversation model.

## Approach

Lean on the SDK. The Claude Agent SDK already stores JSONL transcripts on the pod filesystem (`~/.claude/projects/`) and provides `listSessions()`, `getSessionMessages()`, `resume`, and `continue` options on `query()`. The pod server exposes these as REST endpoints and extends the WebSocket protocol. No changes to the main Nuxt app or database schema are needed.

## Pod Server API Surface

### REST Endpoints (new file: `src/routes/sessions.ts`)

**`GET /api/sessions`**

- Calls SDK's `listSessions({ dir: WORKSPACE_DIR })`
- Returns: `{ sessions: [{ sessionId, title, lastModified, firstPrompt }] }`
- Sorted by `lastModified` descending

**`GET /api/sessions/:id/messages`**

- Calls SDK's `getSessionMessages(id)`
- Maps SDK message format to editor's `ChatMessage` shape (text blocks + tool use blocks)
- Returns: `{ messages: ChatMessage[] }`

**`DELETE /api/sessions/:id`**

- Locates the transcript file via session metadata
- Removes it with `fs.unlink`
- Returns 204 on success, 404 if not found

### WebSocket Changes (`src/routes/ws.ts`)

**Connection:** Accepts optional query parameter `/ws?session=<sessionId>`

**First query():**

- If `session` param provided: `query({ prompt, options: { resume: sessionId, ... } })`
- If no `session` param: `query({ prompt, options: { ... } })` (fresh session)

**Subsequent queries** in the same WebSocket connection: `query({ prompt, options: { continue: true, ... } })`

**New outbound message type:** `{ type: "session_info", sessionId: "..." }` sent after the first query completes, so the editor knows which session was created/resumed.

## Editor SPA Changes

### Chat Tab Rework

The Chat tab becomes a two-state view controlled by a reactive `currentSessionId` ref (no new Vue Router routes):

**State 1: Session List** (default)

- Fetches `GET /api/sessions` on mount
- Renders conversation cards: title (or truncated first prompt), relative timestamp
- "New conversation" button at top
- Tap a conversation -> switch to chat view with that session ID
- Swipe-left to reveal delete action
- Empty state when no conversations exist

**State 2: Chat View** (session selected or "new" tapped)

- If session ID: fetches `GET /api/sessions/:id/messages` to pre-populate history, then opens `/ws?session=<id>`
- If no session ID: opens `/ws` (fresh session), captures session ID from `session_info` message
- Back button in header returns to session list
- Re-fetches session list on return

### Composables

**`useSessions`** (new)

- `sessions` — reactive ref of session summaries
- `fetchSessions()` — `GET /api/sessions`
- `loadMessages(sessionId)` — `GET /api/sessions/:id/messages`
- `deleteSession(sessionId)` — `DELETE /api/sessions/:id`

**`useWebSocket`** (modified)

- Accepts optional `sessionId` parameter
- Builds URL as `/ws` or `/ws?session=<id>`
- Handles `session_info` message type, exposes reactive `sessionId` ref
- `messages` ref can be pre-populated with loaded history before WebSocket connects

## Error Handling

- **Resume fails** (corrupt/missing transcript): Fall back to fresh session, send error message to client
- **WebSocket disconnect mid-conversation**: SDK query interrupted server-side. User can resume from session list later.
- **Delete active session**: No protection needed (single-user app)
- **Empty sessions**: No transcript created until first `query()` runs, so "new conversation" without a message leaves no orphan

## What Stays the Same

- Main Nuxt app: no changes (no new DB tables, no proxy changes)
- Pod server health/files endpoints: unchanged
- Editor Files and Preview tabs: unchanged
- Bottom tab bar: still three tabs (Chat, Files, Preview)
