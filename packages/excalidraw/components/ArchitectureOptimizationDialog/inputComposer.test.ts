import { adjustInputComposerTextareaHeight } from "./inputComposer";

describe("adjustInputComposerTextareaHeight", () => {
  it("shrinks textarea height after deleting text", () => {
    const textarea = document.createElement("textarea");
    let measuredScrollHeight = 360;

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => (textarea.style.height === "auto" ? measuredScrollHeight : 360),
    });

    adjustInputComposerTextareaHeight(textarea, 600);
    expect(textarea.style.height).toBe("300px");
    expect(textarea.style.overflowY).toBe("auto");

    measuredScrollHeight = 56;
    adjustInputComposerTextareaHeight(textarea, 600);
    expect(textarea.style.height).toBe("124px");
  });

  it("enables vertical scroll when content exceeds max height", () => {
    const textarea = document.createElement("textarea");

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => 360,
    });

    adjustInputComposerTextareaHeight(textarea, 600);
    expect(textarea.style.height).toBe("300px");
    expect(textarea.style.overflowY).toBe("auto");
  });
});
