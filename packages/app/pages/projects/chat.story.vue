<script setup lang="ts">
import ChatInput from "~/components/chat/ChatInput.vue";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import SessionList from "~/components/chat/SessionList.vue";
</script>

<template>
  <Story title="Pages / Project Chat" group="pages">
    <Variant title="Session List">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="chat-page">
          <SessionList
            :sessions="[
              {
                sessionId: '1',
                title: 'Fix login bug',
                lastModified: Date.now() / 1000 - 300,
                firstPrompt: 'There is a bug in the login flow',
              },
              {
                sessionId: '2',
                title: 'Add dark mode',
                lastModified: Date.now() / 1000 - 7200,
                firstPrompt: 'Help me add dark mode support',
              },
              {
                sessionId: '3',
                title: 'Refactor API routes',
                lastModified: Date.now() / 1000 - 86400,
                firstPrompt: 'Lets clean up the API',
              },
            ]"
            :active-sessions="['1']"
          />
        </div>
      </div>
    </Variant>

    <Variant title="Active Chat">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="chat-page">
          <div class="chat-view">
            <div class="chat-header">
              <button class="btn-back" aria-label="Back to sessions">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="12 4 6 10 12 16" />
                </svg>
              </button>
              <span class="chat-title">Conversation</span>
            </div>
            <div class="messages-container">
              <ChatMessage
                :message="{
                  role: 'user',
                  content:
                    'Help me fix the login bug where users get redirected to a 404 page after authenticating.',
                }"
              />
              <ChatMessage
                :message="{
                  role: 'assistant',
                  content:
                    'I\'ll investigate the login flow. Let me check the auth callback handler and the redirect logic.\n\nThe issue is in `server/routes/auth/github/callback.ts`. After successful authentication, the redirect URL is constructed without checking if the session cookie was properly set. Let me fix this.',
                  toolUse: [{ name: 'Read', input: 'server/routes/auth/github.ts' }],
                }"
              />
              <ChatMessage
                :message="{
                  role: 'user',
                  content: 'That looks right. Can you also add a test for it?',
                }"
              />
            </div>
            <ChatInput :is-streaming="false" />
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Streaming">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="chat-page">
          <div class="chat-view">
            <div class="chat-header">
              <button class="btn-back" aria-label="Back to sessions">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="12 4 6 10 12 16" />
                </svg>
              </button>
              <span class="chat-title">New Conversation</span>
            </div>
            <div class="messages-container">
              <ChatMessage
                :message="{
                  role: 'user',
                  content: 'Create a new API endpoint for managing user preferences.',
                }"
              />
              <ChatMessage
                :message="{
                  role: 'assistant',
                  content:
                    'I\'ll create a new API endpoint for user preferences. First, let me add the schema...',
                }"
              />
              <div class="streaming-indicator">
                <span class="streaming-dot" />
                <span class="streaming-dot" />
                <span class="streaming-dot" />
              </div>
            </div>
            <ChatInput :is-streaming="true" />
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Empty Conversation">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="chat-page">
          <div class="chat-view">
            <div class="chat-header">
              <button class="btn-back" aria-label="Back to sessions">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="12 4 6 10 12 16" />
                </svg>
              </button>
              <span class="chat-title">New Conversation</span>
            </div>
            <div class="messages-container">
              <div class="chat-empty">
                <p class="chat-empty-text">Send a message to start the conversation.</p>
              </div>
            </div>
            <ChatInput :is-streaming="false" />
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-back:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}
.btn-back svg {
  width: 20px;
  height: 20px;
}

.chat-title {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: var(--space-3) 0;
}

.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-7);
}

.chat-empty-text {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-align: center;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-3) var(--space-5);
}

.streaming-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.streaming-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.streaming-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
  0%,
  80%,
  100% {
    opacity: 0.25;
    transform: scale(0.75);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
