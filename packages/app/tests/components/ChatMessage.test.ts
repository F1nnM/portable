import type { ChatMessage } from "../../types/chat";
import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import ChatMessageComponent from "../../components/chat/ChatMessage.vue";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: "user",
    content: "Hello, world!",
    ...overrides,
  };
}

describe("chatMessage", () => {
  it("renders user message with correct content", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: { message: makeMessage({ role: "user", content: "Test question" }) },
    });
    expect(wrapper.text()).toContain("Test question");
    expect(wrapper.find(".message-user").exists()).toBe(true);
  });

  it("renders assistant message with correct content", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({ role: "assistant", content: "Test response" }),
      },
    });
    expect(wrapper.text()).toContain("Test response");
    expect(wrapper.find(".message-assistant").exists()).toBe(true);
  });

  it("renders markdown in assistant messages", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({ role: "assistant", content: "**bold text**" }),
      },
    });
    const html = wrapper.find(".message-content").html();
    expect(html).toContain("<strong>");
    expect(html).toContain("bold text");
  });

  it("renders tool use entries for assistant messages", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({
          role: "assistant",
          content: "I ran a tool.",
          toolUse: [{ name: "read_file", input: '{"path": "test.ts"}' }],
        }),
      },
    });
    expect(wrapper.text()).toContain("read_file");
    expect(wrapper.find(".tool-use-entry").exists()).toBe(true);
  });

  it("renders thinking blocks as collapsible", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({
          role: "assistant",
          content: "Here is my answer.",
          thinking: [{ content: "Let me think about this...", durationMs: 3500 }],
        }),
      },
    });
    expect(wrapper.find(".thinking-block").exists()).toBe(true);
    expect(wrapper.text()).toContain("Thought for");
    // Content should be hidden by default
    expect(wrapper.find(".thinking-content").exists()).toBe(false);
  });

  it("expands thinking block on click", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({
          role: "assistant",
          content: "Answer",
          thinking: [{ content: "Deep thoughts here", durationMs: 2000 }],
        }),
      },
    });
    await wrapper.find(".thinking-toggle").trigger("click");
    expect(wrapper.find(".thinking-content").exists()).toBe(true);
    expect(wrapper.text()).toContain("Deep thoughts here");
  });

  it("renders result metadata footer", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({
          role: "assistant",
          content: "Done!",
          resultMeta: { costUsd: 0.05, durationMs: 12000, numTurns: 3, isError: false },
        }),
      },
    });
    expect(wrapper.find(".result-meta").exists()).toBe(true);
    expect(wrapper.text()).toContain("3 turns");
    expect(wrapper.text()).toContain("$0.05");
  });

  it("shows error indicator in result meta when isError is true", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({
          role: "assistant",
          content: "Error occurred",
          resultMeta: { costUsd: 0.01, durationMs: 1000, numTurns: 1, isError: true },
        }),
      },
    });
    expect(wrapper.find(".result-meta-error").exists()).toBe(true);
  });

  it("does not render markdown for user messages", async () => {
    const wrapper = await mountSuspended(ChatMessageComponent, {
      props: {
        message: makeMessage({ role: "user", content: "**not bold**" }),
      },
    });
    // User messages should show raw text, not rendered markdown
    expect(wrapper.find(".message-content").html()).not.toContain("<strong>");
  });
});
