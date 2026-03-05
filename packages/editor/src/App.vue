<script setup lang="ts">
</script>

<template>
  <div class="app">
    <h1>Portable Editor</h1>
    <p>Mobile-first code editor</p>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #1e1e1e;
  color: #d4d4d4;
  min-height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}
</style>
