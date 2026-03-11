<script setup lang="ts">
import { reactive } from "vue";
import ChatInput from "./ChatInput.vue";

const state = reactive({
  lastSent: "",
  interrupted: false,
});

function handleSend(content: string) {
  state.lastSent = content;
}

function handleInterrupt() {
  state.interrupted = true;
  setTimeout(() => {
    state.interrupted = false;
  }, 1000);
}
</script>

<template>
  <Story title="Chat / ChatInput" group="chat">
    <Variant title="Idle">
      <div style="max-width: 480px">
        <ChatInput :is-streaming="false" @send="handleSend" @interrupt="handleInterrupt" />
        <div v-if="state.lastSent" style="padding: 12px; font-size: 13px; color: #6b6560">
          Last sent: "{{ state.lastSent }}"
        </div>
      </div>
    </Variant>

    <Variant title="Streaming (Interrupt Mode)">
      <div style="max-width: 480px">
        <ChatInput :is-streaming="true" @send="handleSend" @interrupt="handleInterrupt" />
        <div v-if="state.interrupted" style="padding: 12px; font-size: 13px; color: #d64545">
          Interrupt triggered
        </div>
      </div>
    </Variant>
  </Story>
</template>
