import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import ChatInput from "../../components/chat/ChatInput.vue";

describe("chatInput", () => {
  it("renders textarea and send button", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: false },
    });
    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(wrapper.find(".btn-send").exists()).toBe(true);
  });

  it("emits send event on button click with textarea content", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: false },
    });
    const textarea = wrapper.find("textarea");
    await textarea.setValue("Hello, Claude!");
    await wrapper.find(".btn-send").trigger("click");
    expect(wrapper.emitted("send")).toBeTruthy();
    expect(wrapper.emitted("send")![0]).toEqual(["Hello, Claude!"]);
  });

  it("clears textarea after sending", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: false },
    });
    const textarea = wrapper.find("textarea");
    await textarea.setValue("Test message");
    await wrapper.find(".btn-send").trigger("click");
    expect((textarea.element as HTMLTextAreaElement).value).toBe("");
  });

  it("does not emit send when textarea is empty", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: false },
    });
    await wrapper.find(".btn-send").trigger("click");
    expect(wrapper.emitted("send")).toBeFalsy();
  });

  it("does not emit send on Enter key (send via button only)", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: false },
    });
    const textarea = wrapper.find("textarea");
    await textarea.setValue("Enter test");
    await textarea.trigger("keydown", { key: "Enter", shiftKey: false });
    expect(wrapper.emitted("send")).toBeFalsy();
  });

  it("shows interrupt button when streaming", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: true },
    });
    expect(wrapper.find(".btn-interrupt").exists()).toBe(true);
    expect(wrapper.find(".btn-send").exists()).toBe(false);
  });

  it("emits interrupt event when interrupt button is clicked", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: true },
    });
    await wrapper.find(".btn-interrupt").trigger("click");
    expect(wrapper.emitted("interrupt")).toBeTruthy();
  });

  it("disables send button when textarea is empty", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { isStreaming: false },
    });
    const sendBtn = wrapper.find(".btn-send");
    expect((sendBtn.element as HTMLButtonElement).disabled).toBe(true);
  });
});
