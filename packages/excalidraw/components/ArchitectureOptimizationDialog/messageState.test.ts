import { describe, expect, it } from "vitest";

import { messagesReducer, type Message } from "./messageState";

const baseMessages: Message[] = [
  { id: "1", role: "user", content: "hi" },
  { id: "2", role: "assistant", content: "hello", isGenerating: true },
  { id: "3", role: "assistant", content: "done" },
];

describe("messagesReducer", () => {
  it("adds messages", () => {
    const next = messagesReducer(baseMessages, {
      type: "add",
      messages: [{ id: "4", role: "user", content: "new" }],
    });
    expect(next).toHaveLength(4);
    expect(next[3].content).toBe("new");
  });

  it("updates a message by id", () => {
    const next = messagesReducer(baseMessages, {
      type: "update",
      id: "2",
      patch: { isGenerating: false, error: "boom" },
    });
    expect(next[1].isGenerating).toBe(false);
    expect(next[1].error).toBe("boom");
  });

  it("appends content", () => {
    const next = messagesReducer(baseMessages, {
      type: "append",
      id: "2",
      chunk: " world",
    });
    expect(next[1].content).toBe("hello world");
  });

  it("updates last matching message", () => {
    const next = messagesReducer(baseMessages, {
      type: "updateLast",
      predicate: (m) => m.role === "assistant" && m.isGenerating,
      patch: { isGenerating: false },
    });
    expect(next[1].isGenerating).toBe(false);
  });

  it("removes by id", () => {
    const next = messagesReducer(baseMessages, { type: "remove", id: "1" });
    expect(next).toHaveLength(2);
    expect(next.find((m) => m.id === "1")).toBeUndefined();
  });

  it("replaces all messages", () => {
    const next = messagesReducer(baseMessages, {
      type: "replace",
      messages: [{ id: "x", role: "system", content: "reset" }],
    });
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("x");
  });
});
