# Background Query Persistence & SDK Event Display

## Context

Two problems to solve together:

1. **Background queries**: When a user navigates away from a chat, the WebSocket closes and the pod server kills the active query (`state.activeQuery.close()` in `ws.ts:142`). Queries should continue running regardless of frontend connection state.

2. **Incomplete SDK event display**: The frontend only processes `assistant` events with `text` and `tool_use` content blocks. It misses streaming text deltas, thinking blocks, tool progress, result metadata (cost/duration/turns), and renders text as plain `pre-wrap` without markdown formatting.

## SDK Event Research Summary

### SDK Message Types (22 total in `SDKMessage` union)

The server currently forwards ALL SDK messages as `{ type: "sdk_event", event: <message> }`. The frontend only processes messages where `event.type === "assistant" || event.type === "result"` and `event.message.content` contains `text`/`tool_use` blocks.

**Messages the frontend should handle:**

| SDK Type                     | `type` field      | `subtype`                 | What it contains                                                   | Frontend action                          |
| ---------------------------- | ----------------- | ------------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| `SDKAssistantMessage`        | `"assistant"`     | -                         | `message: BetaMessage` with content blocks                         | Extract text, tool_use, thinking blocks  |
| `SDKPartialAssistantMessage` | `"stream_event"`  | -                         | `event: BetaRawMessageStreamEvent`                                 | Stream text/thinking deltas in real-time |
| `SDKResultMessage`           | `"result"`        | `"success"` / `"error_*"` | `total_cost_usd`, `duration_ms`, `num_turns`, `is_error`, `result` | Show completion status + metadata        |
| `SDKToolProgressMessage`     | `"tool_progress"` | -                         | `tool_name`, `elapsed_time_seconds`, `tool_use_id`                 | Show tool execution progress indicator   |
| `SDKStatusMessage`           | `"system"`        | `"status"`                | `status: "compacting" \| null`                                     | Show "Compacting context..." indicator   |
| `SDKTaskStartedMessage`      | `"system"`        | `"task_started"`          | `task_id`, `description`                                           | Show subagent task started               |
| `SDKTaskProgressMessage`     | `"system"`        | `"task_progress"`         | `task_id`, `description`, `usage`, `last_tool_name`                | Update subagent progress                 |
| `SDKTaskNotificationMessage` | `"system"`        | `"task_notification"`     | `task_id`, `status`, `summary`                                     | Show subagent completion                 |

**Messages to ignore (not relevant for display):**

- `SDKUserMessage` / `SDKUserMessageReplay` -- already shown from local state
- `SDKSystemMessage` (init) -- internal SDK state
- `SDKCompactBoundaryMessage` -- internal SDK marker
- `SDKHook*` messages -- hooks not used in pod-server context
- `SDKAuthStatusMessage` -- auth handled externally
- `SDKFilesPersistedEvent` -- internal file persistence
- `SDKRateLimitEvent` -- could show in future, skip for now
- `SDKElicitationCompleteMessage` -- MCP elicitation
- `SDKPromptSuggestionMessage` -- could show in future, skip for now
- `SDKLocalCommandOutputMessage` -- local command output
- `SDKToolUseSummaryMessage` -- summary of tool use

### Content Block Types (within BetaMessage.content)

| Type       | Shape                                                            | Currently handled               |
| ---------- | ---------------------------------------------------------------- | ------------------------------- |
| `text`     | `{ type: "text", text: string }`                                 | Yes (accumulated as plain text) |
| `tool_use` | `{ type: "tool_use", id: string, name: string, input: unknown }` | Yes (name + input JSON)         |
| `thinking` | `{ type: "thinking", thinking: string, signature: string }`      | **No**                          |

### Streaming Events (BetaRawMessageStreamEvent, within SDKPartialAssistantMessage)

The SDK yields `stream_event` messages with these delta types:

- `content_block_start` -- start of a new text/tool_use/thinking block
- `content_block_delta` with `text_delta` -- incremental text
- `content_block_delta` with `input_json_delta` -- incremental tool input JSON
- `content_block_delta` with `thinking_delta` -- incremental thinking text
- `content_block_delta` with `signature_delta` -- thinking signature (ignore)
- `content_block_stop` -- end of content block
- `message_start`, `message_delta`, `message_stop` -- message-level events

**Current behavior**: The frontend only processes complete `assistant` messages, NOT `stream_event` messages. This means text appears all at once when the query ends, rather than streaming incrementally.

### Sessions API Gap

`/api/sessions/:id/messages` (`sessions.ts:71-103`) also only extracts `text` and `tool_use` blocks, discarding `thinking` blocks and result metadata. This needs updating too so loaded session history includes thinking blocks.

---

## Files to Change

### New Files

- `packages/pod-server/src/session-manager.ts` -- Background session management
- `packages/pod-server/src/routes/active-sessions.ts` -- Active sessions endpoint
- `packages/pod-server/tests/session-manager.test.ts`
- `packages/pod-server/tests/active-sessions.test.ts`

### Modified Files

- `packages/pod-server/src/routes/ws.ts` -- Delegate to session manager
- `packages/pod-server/src/routes/sessions.ts` -- Extract thinking blocks from history
- `packages/pod-server/src/app.ts` -- Register active sessions route
- `packages/pod-server/tests/ws.test.ts` -- Update for new architecture
- `packages/editor/src/composables/useWebSocket.ts` -- Streaming deltas, replay, thinking, result metadata, reconnect fix
- `packages/editor/src/composables/useSessions.ts` -- Fetch active sessions
- `packages/editor/src/components/ChatMessage.vue` -- Render thinking blocks, markdown, tool progress, result metadata
- `packages/editor/src/components/SessionList.vue` -- Show running indicators
- `packages/editor/tests/components/ChatMessage.test.ts` -- Tests for new rendering
- `packages/editor/tests/composables/useWebSocket.test.ts` -- Tests for streaming/replay

### No Changes Needed

- `packages/editor/src/views/ChatView.vue` -- `goBack()` closing WS is fine; server keeps query alive

---

## Implementation

### Phase 1: Pod Server Backend (Background Query Persistence)

#### Task 1: Create `session-manager.ts` ∥

New module-level singleton managing background sessions.

```typescript
interface BackgroundSession {
  id: string; // crypto.randomUUID()
  sdkSessionId: string | null; // set from first SDK event
  activeQuery: Query | null;
  isRunning: boolean;
  isFirstQuery: boolean;
  pendingPrompt: string | null;
  currentQueryEvents: OutboundMessage[]; // buffer for current query
  clients: Set<WSContext<NodeWebSocket>>; // 0..N connected clients
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}
```

Exported functions:

- `createSession()` -- create new background session
- `getSession(id)` -- get by internal ID
- `getSessionBySdkId(sdkSessionId)` -- look up by Claude session ID
- `getActiveSdkSessionIds()` -- list sessions with running queries
- `attachClient(session, ws)` -- add WS client, cancel cleanup timer
- `detachClient(session, ws)` -- remove WS client; do NOT kill query
- `sendMessage(session, prompt)` -- start or queue a query (fire-and-forget)
- `interruptQuery(session)` -- interrupt the active query

Core behavior of `runQuery()` (private):

- Build SDK options (same as current `ws.ts`): `resume` for first query with sessionId, `continue` for subsequent
- Clear event buffer, push `query_start`, iterate SDK async generator
- Each event: push to buffer AND broadcast to all connected clients
- Capture `session_id` from first SDK event, index it
- On complete: push `session_info` (first query only) and `query_end` to buffer
- If no clients connected after query ends, start 30s cleanup timer
- Check `pendingPrompt` for queued follow-up queries

`sendMessage()` fires `runQuery()` without awaiting (with `.catch()` for safety).

#### Task 2: Rewrite `ws.ts` to delegate to SessionManager ∥

Remove `ConnectionState` interface and `runQuery` function entirely. The WS route becomes a thin bridge:

- **`onOpen`**: Check `?session=<sdkSessionId>`. If an active background session exists for that ID, attach and replay `currentQueryEvents` (only if `session.isRunning`). Otherwise create a new session.
- **`onMessage`**: Delegate to `sendMessage()` or `interruptQuery()` on the session
- **`onClose`/`onError`**: Call `detachClient()` -- query keeps running

Replay protocol: send `{ type: "replay_start" }`, then all buffered events, then `{ type: "replay_end" }`. Only replay when `session.isRunning` is true.

#### Task 3: Create `active-sessions.ts` endpoint + register in `app.ts`

`GET /api/sessions/active` returns `{ activeSessionIds: string[] }` -- SDK session IDs with running queries.

Add `import { activeSessions }` and `app.route("/", activeSessions)` in `app.ts`.

### Phase 2: Editor Frontend (SDK Event Display + Background Support)

#### Task 4: Rewrite `useWebSocket.ts` for streaming + replay

Extend the type system and message handling:

**New types:**

```typescript
interface SdkThinkingBlock {
  type: "thinking";
  thinking: string;
}

type SdkContentBlock = SdkTextBlock | SdkToolUseBlock | SdkThinkingBlock;

interface ToolUseEntry {
  name: string;
  input: string;
}

interface ThinkingEntry {
  content: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolUse?: ToolUseEntry[];
  thinking?: ThinkingEntry[];
  // Result metadata (from SDKResultMessage, displayed after assistant message)
  resultMeta?: {
    costUsd: number;
    durationMs: number;
    numTurns: number;
    isError: boolean;
  };
}
```

**Streaming delta handling:**

Process `stream_event` messages (SDKPartialAssistantMessage) for real-time text display:

```typescript
case "sdk_event": {
  const event = parsed.event;
  if (!event) break;

  // Complete assistant message (with content blocks)
  if (event.type === "assistant" && event.message?.content) {
    processContentBlocks(event.message.content);
  }
  // Streaming deltas for real-time text
  else if (event.type === "stream_event" && event.event) {
    handleStreamEvent(event.event);
  }
  // Result message with metadata
  else if (event.type === "result") {
    handleResultMessage(event);
  }
  break;
}
```

`handleStreamEvent()` processes `BetaRawMessageStreamEvent`:

- `content_block_start`: Track current block type/index
- `content_block_delta` with `text_delta`: Append to `pendingText`, update the last message in real-time (push a temporary message to `messages` array)
- `content_block_delta` with `thinking_delta`: Append to `pendingThinking`
- `content_block_delta` with `input_json_delta`: Accumulate partial JSON for tool input
- `content_block_stop`: Finalize the block

**Important design decision**: When streaming, update the current assistant message in-place (push to messages array and update `content` reactively) rather than waiting for `query_end`. This gives real-time text display. On `query_end`, finalize the message with complete data.

**Replay handling:**

- Add `"replay_start" | "replay_end"` to InboundMessage types
- These are no-ops in the handler -- replayed events (query_start, sdk_event, query_end) are processed identically to live events

**Reconnect URL fix:**

- `buildWsUrl()`: Use `sessionId.value ?? options?.sessionId` instead of just `options?.sessionId`

#### Task 5: Update `ChatMessage.vue` for rich rendering

Add rendering for:

1. **Thinking blocks** (collapsible, similar to tool use):
   - Show "Thinking..." label with expand/collapse
   - Render thinking content in a styled block (dimmed, italic)

2. **Streaming text** (already works if useWebSocket updates message.content reactively)

3. **Result metadata** (shown at end of assistant message):
   - Small footer: "X turns, Y.Zs, $0.XX" or error indicator

4. **Markdown rendering**: Use `marked` + `DOMPurify` (new dependencies):
   - Install: `bun add --filter @portable/editor marked dompurify` (+ `@types/dompurify`)
   - Render `message.content` as markdown via `marked.parse()` then sanitize with `DOMPurify.sanitize()`
   - Use `v-html` directive for rendered markdown output
   - Support: headings, bold, italic, code blocks, inline code, lists, links

5. **Tool progress indicators** (from `SDKToolProgressMessage`):
   - Show "Running {tool_name}... {elapsed}s" while tools are executing
   - Track active tools via `tool_use_id` -- start on `tool_progress`, end on next `content_block_stop` or `assistant` message
   - Render as small animated status line below the streaming message

#### Task 6: Update `sessions.ts` (pod-server) to include thinking blocks

Update the messages endpoint to extract `thinking` blocks alongside `text` and `tool_use`:

```typescript
const thinking = blocks
  .filter((b) => b.type === "thinking")
  .map((b) => ({ content: b.thinking || "" }));
```

Include in response so loaded session history shows thinking blocks.

#### Task 7: Update `useSessions.ts` + `SessionList.vue`

**useSessions.ts:**

- Add `activeSessions` ref (`Set<string>`) and `fetchActiveSessions()` function
- `fetchActiveSessions()` calls `GET /api/sessions/active`

**SessionList.vue:**

- Call `fetchActiveSessions()` on mount alongside `fetchSessions()`
- Poll `fetchActiveSessions()` every 5 seconds while mounted (cleanup on unmount)
- Show pulsing dot indicator on sessions with running queries
- Re-fetch `fetchSessions()` when returning to the list

### Phase 3: Tests

#### Task 8: `session-manager.test.ts`

- Session CRUD, attach/detach
- Query continues after all clients detach
- Events buffered with zero clients
- Reconnect replays buffered events
- Cleanup timer fires after inactivity
- `getActiveSdkSessionIds` returns only running sessions
- Pending prompt queuing

#### Task 9: Update `ws.test.ts`

- Remove "calls close() on disconnect" test (behavior reversed)
- Add "query continues after client disconnects"
- Add "reconnect replays buffered events for running query"
- Add "reconnect to completed query does not replay"
- Existing tests updated for session manager

#### Task 10: `active-sessions.test.ts`

- Returns empty array when no sessions active
- Returns IDs for running queries
- Does not return completed sessions

#### Task 11: Update editor tests

- `useWebSocket`: streaming deltas processed, replay messages, reconnect URL fix, thinking block accumulation
- `ChatMessage`: thinking block rendering, result metadata display, markdown rendering
- `useSessions`: `fetchActiveSessions` populates set

### Phase 4: Code Review & Documentation

- Code review of all changes
- Update CLAUDE.md with: session manager architecture, replay protocol, active sessions endpoint, SDK event display

---

## Verification

1. `bun run --filter @portable/pod-server test` -- all pod-server tests pass
2. `bun run --filter @portable/editor test` -- all editor tests pass
3. `bun run test` -- full test suite passes
4. `bun run lint` -- no lint errors
5. `bun run typecheck` -- no type errors
6. Manual test in dev environment:
   - Start a chat, send a message, see text stream in real-time (not all at once)
   - Navigate to Preview tab while Claude is working
   - Navigate back -- should see completed response
   - Check thinking blocks are collapsible
   - Check result metadata shown after response
   - Check markdown renders correctly (code blocks, bold, lists)
   - Check session list shows pulsing dot for active sessions
