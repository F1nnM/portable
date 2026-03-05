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
  <div style="max-width: 500px; margin: 2rem auto; padding: 0 1rem; font-family: sans-serif">
    <h1>Todos</h1>

    <form @submit.prevent="addTodo" style="display: flex; gap: 0.5rem; margin-bottom: 1rem">
      <input
        v-model="newTitle"
        type="text"
        placeholder="What needs to be done?"
        style="flex: 1; padding: 0.5rem; font-size: 1rem"
      />
      <button type="submit" style="padding: 0.5rem 1rem; font-size: 1rem">Add</button>
    </form>

    <ul style="list-style: none; padding: 0">
      <li
        v-for="todo in todos"
        :key="todo.id"
        style="
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #eee;
        "
      >
        <input
          type="checkbox"
          :checked="todo.completed"
          @change="toggleTodo(todo.id)"
          style="width: 1.2rem; height: 1.2rem"
        />
        <span
          :style="{ flex: 1, textDecoration: todo.completed ? 'line-through' : 'none' }"
        >
          {{ todo.title }}
        </span>
        <button @click="deleteTodo(todo.id)" style="color: red; border: none; background: none; cursor: pointer">
          Delete
        </button>
      </li>
    </ul>

    <p v-if="todos && todos.length === 0" style="color: #888; text-align: center">
      No todos yet. Add one above!
    </p>
  </div>
</template>
