<script setup lang="ts">
import { ref } from "vue";
import CodeViewer from "./CodeViewer.vue";

const isReadOnly = ref(true);

const tsContent = `import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql);

export async function getUsers() {
  return db.select().from(users).orderBy(users.createdAt);
}

export async function createUser(email: string, name: string) {
  return db.insert(users).values({ email, name }).returning();
}`;

const vueContent = `<script setup lang="ts">
const props = defineProps<{
  title: string;
  count: number;
}>();

const doubled = computed(() => props.count * 2);
<\/script>

<template>
  <div class="counter">
    <h2>{{ title }}</h2>
    <p>Count: {{ count }} (doubled: {{ doubled }})</p>
    <button @click="$emit('increment')">+1</button>
  </div>
</template>

<style scoped>
.counter {
  padding: 16px;
  border-radius: 8px;
  background: #f5f5f5;
}
</style>`;

const jsonContent = `{
  "name": "@portable/app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "test": "vitest run"
  },
  "dependencies": {
    "nuxt": "^3.16.0",
    "vue": "^3.5.13"
  }
}`;

const cssContent = `:root {
  --color-bg: #f6f4f1;
  --color-text: #2c2825;
  --color-accent: #d97a3e;
}

.button {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  border-radius: 8px;
  font-weight: 600;
  transition: background 150ms ease;
}

.button:hover {
  background: #c46a2e;
}`;

function logAction(action: string, ...args: unknown[]) {
  console.log(`[CodeViewer] ${action}`, ...args);
}
</script>

<template>
  <Story title="Files / CodeViewer" group="files">
    <Variant title="TypeScript (Read Only)">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <CodeViewer
          filename="server/utils/db.ts"
          :content="tsContent"
          :read-only="true"
          @back="logAction('back')"
          @save="(c) => logAction('save', c)"
          @toggle-edit="logAction('toggleEdit')"
        />
      </div>
    </Variant>

    <Variant title="TypeScript (Edit Mode)">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <CodeViewer
          filename="server/utils/db.ts"
          :content="tsContent"
          :read-only="false"
          @back="logAction('back')"
          @save="(c) => logAction('save', c)"
          @toggle-edit="logAction('toggleEdit')"
        />
      </div>
    </Variant>

    <Variant title="Vue SFC">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <CodeViewer
          filename="components/Counter.vue"
          :content="vueContent"
          :read-only="true"
          @back="logAction('back')"
          @save="(c) => logAction('save', c)"
          @toggle-edit="logAction('toggleEdit')"
        />
      </div>
    </Variant>

    <Variant title="JSON">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <CodeViewer
          filename="package.json"
          :content="jsonContent"
          :read-only="true"
          @back="logAction('back')"
          @save="(c) => logAction('save', c)"
          @toggle-edit="logAction('toggleEdit')"
        />
      </div>
    </Variant>

    <Variant title="CSS">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <CodeViewer
          filename="tokens.css"
          :content="cssContent"
          :read-only="true"
          @back="logAction('back')"
          @save="(c) => logAction('save', c)"
          @toggle-edit="logAction('toggleEdit')"
        />
      </div>
    </Variant>

    <Variant title="Toggle Read/Edit">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <CodeViewer
          filename="server/utils/db.ts"
          :content="tsContent"
          :read-only="isReadOnly"
          @back="logAction('back')"
          @save="(c) => logAction('save', c)"
          @toggle-edit="isReadOnly = !isReadOnly"
        />
      </div>
    </Variant>
  </Story>
</template>
