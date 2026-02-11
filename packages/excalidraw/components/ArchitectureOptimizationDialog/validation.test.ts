import { buildGenerationSnapshot } from "./planGenerationContext";
import { validateGenerationResult } from "./validation";

describe("validateGenerationResult", () => {
  it("fails when summary count differs from selected suggestions", () => {
    const snapshot = buildGenerationSnapshot(
      [
        {
          id: "s1",
          category: "performance",
          title: "A",
          content: "A",
          fullContent: "A",
          selected: true,
        },
      ],
      "standard",
      null,
      null,
    );

    const result = validateGenerationResult({
      summary:
        "- [性能] A：优化A\n- [性能] B：优化B\n- [性能] C：优化C",
      mermaid: "graph TD\nA[App] --> B[(DB)]",
      snapshot,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("条数");
    }
  });

  it("passes when count and categories are valid", () => {
    const snapshot = buildGenerationSnapshot(
      [
        {
          id: "s1",
          category: "performance",
          title: "A",
          content: "A",
          fullContent: "A",
          selected: true,
        },
      ],
      "standard",
      null,
      null,
    );
    const result = validateGenerationResult({
      summary: "- [性能] A：优化A",
      mermaid: "graph TD\nA[App] --> B[(DB)]",
      snapshot,
    });
    expect(result).toEqual({ ok: true });
  });
});
