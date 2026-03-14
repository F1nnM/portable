<script setup lang="ts">
interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

const newTitle = ref("");
const { data: todos, refresh } = await useFetch<Todo[]>("/api/todos");

async function addTodo() {
  const title = newTitle.value.trim();
  if (!title) return;

  await $fetch("/api/todos", {
    method: "POST",
    body: { title },
  });
  newTitle.value = "";
  await refresh();
}

async function toggleTodo(id: number) {
  await $fetch(`/api/todos/${id}`, { method: "PATCH" });
  await refresh();
}

async function deleteTodo(id: number) {
  await $fetch(`/api/todos/${id}`, { method: "DELETE" });
  await refresh();
}
</script>

<template>
  <div class="w-full px-4 py-6">
    <h1 class="mb-6 text-2xl font-bold">Todos</h1>

    <form @submit.prevent="addTodo" class="mb-6 flex gap-2">
      <input
        v-model="newTitle"
        type="text"
        placeholder="What needs to be done?"
        class="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-base placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
      <button
        type="submit"
        class="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white transition-colors hover:bg-neutral-700 active:bg-neutral-800"
      >
        Add
      </button>
    </form>

    <ul class="divide-y divide-neutral-200">
      <li
        v-for="todo in todos"
        :key="todo.id"
        class="flex items-center gap-3 py-3"
      >
        <input
          type="checkbox"
          :checked="todo.completed"
          @change="toggleTodo(todo.id)"
          class="size-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span
          class="flex-1"
          :class="{ 'text-neutral-400 line-through': todo.completed }"
        >
          {{ todo.title }}
        </span>
        <button
          @click="deleteTodo(todo.id)"
          class="text-sm text-neutral-400 transition-colors hover:text-red-500"
        >
          Delete
        </button>
      </li>
    </ul>

    <p v-if="todos && todos.length === 0" class="py-8 text-center text-neutral-400">
      No todos yet. Add one above!
    </p>
  </div>
</template>
