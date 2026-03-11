<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import ChatMessageComponent from "./ChatMessage.vue";

const userMessage: ChatMessage = {
  role: "user",
  content: "Can you help me set up a database connection using Drizzle ORM?",
};

const assistantSimple: ChatMessage = {
  role: "assistant",
  content:
    "Sure! Here's how to set up a **Drizzle ORM** connection with PostgreSQL:\n\n```typescript\nimport { drizzle } from 'drizzle-orm/postgres-js';\nimport postgres from 'postgres';\n\nconst sql = postgres(process.env.DATABASE_URL!);\nconst db = drizzle(sql);\n```\n\nThis creates a connection pool and wraps it with Drizzle's query builder.",
};

const assistantWithThinking: ChatMessage = {
  role: "assistant",
  content:
    "I've analyzed the codebase and found the issue. The `useAuth` composable is not properly refreshing the session token after expiry.\n\nHere's the fix:\n\n```typescript\nasync function refresh() {\n  const data = await $fetch('/api/auth/me');\n  user.value = data.user;\n}\n```",
  thinking: [
    {
      content:
        "The user is asking about an auth issue. Let me look at the useAuth composable and the session middleware to understand the flow...",
      durationMs: 3200,
    },
  ],
};

const assistantWithToolUse: ChatMessage = {
  role: "assistant",
  content: "I've read the file and found the configuration. Let me update it for you.",
  toolUse: [
    { name: "Read", input: '{"file_path": "/home/user/project/nuxt.config.ts"}' },
    {
      name: "Edit",
      input:
        '{"file_path": "/home/user/project/nuxt.config.ts", "old_string": "ssr: false", "new_string": "ssr: true"}',
    },
  ],
};

const assistantWithResultMeta: ChatMessage = {
  role: "assistant",
  content:
    "Done! I've updated the configuration and verified the changes work correctly.\n\n- Changed SSR mode to `true`\n- Updated the build configuration\n- Ran the type checker",
  resultMeta: {
    numTurns: 5,
    durationMs: 23400,
    costUsd: 0.0342,
    isError: false,
  },
};

const assistantErrorResult: ChatMessage = {
  role: "assistant",
  content: "I encountered an error while trying to install the dependencies.",
  resultMeta: {
    numTurns: 2,
    durationMs: 8700,
    costUsd: 0.0089,
    isError: true,
  },
};

const assistantRichMarkdown: ChatMessage = {
  role: "assistant",
  content: `## Database Schema Design

Here's a recommended schema for the user management system:

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| email | varchar(255) | UNIQUE, NOT NULL |
| name | varchar(100) | NOT NULL |
| created_at | timestamp | DEFAULT NOW() |

### Key considerations:

1. Use **UUIDs** instead of auto-incrementing IDs for better distribution
2. Add an index on \`email\` for fast lookups
3. Consider adding a \`deleted_at\` column for soft deletes

> Note: This follows the existing patterns in the codebase.

---

Here's the migration code:

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\``,
};
</script>

<template>
  <Story title="Chat / ChatMessage" group="chat">
    <Variant title="User Message">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="userMessage" />
      </div>
    </Variant>

    <Variant title="Assistant - Simple">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="assistantSimple" />
      </div>
    </Variant>

    <Variant title="Assistant - With Thinking">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="assistantWithThinking" />
      </div>
    </Variant>

    <Variant title="Assistant - With Tool Use">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="assistantWithToolUse" />
      </div>
    </Variant>

    <Variant title="Assistant - With Result Meta">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="assistantWithResultMeta" />
      </div>
    </Variant>

    <Variant title="Assistant - Error Result">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="assistantErrorResult" />
      </div>
    </Variant>

    <Variant title="Assistant - Rich Markdown">
      <div style="max-width: 640px; padding: 16px">
        <ChatMessageComponent :message="assistantRichMarkdown" />
      </div>
    </Variant>

    <Variant title="Conversation Thread">
      <div style="max-width: 640px; padding: 16px; display: flex; flex-direction: column; gap: 4px">
        <ChatMessageComponent :message="userMessage" />
        <ChatMessageComponent :message="assistantWithThinking" />
        <ChatMessageComponent
          :message="{
            role: 'user',
            content: 'Can you show me the full schema with all tables?',
          }"
        />
        <ChatMessageComponent :message="assistantRichMarkdown" />
      </div>
    </Variant>
  </Story>
</template>
