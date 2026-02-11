import { describe, expect, it } from "vitest";

import { buildSuggestionDedupKey } from "./model";

describe("buildSuggestionDedupKey", () => {
  it("treats formatting variants as the same suggestion", () => {
    const a = buildSuggestionDedupKey(
      "performance",
      "- [性能] 优化MySQL：实现读写分离",
    );
    const b = buildSuggestionDedupKey(
      "performance",
      "优化MySQL: 实现读写分离",
    );

    expect(a).toBe(b);
  });

  it("keeps different categories separated", () => {
    const performance = buildSuggestionDedupKey(
      "performance",
      "扩展Redis集群提升并发能力",
    );
    const reliability = buildSuggestionDedupKey(
      "reliability",
      "扩展Redis集群提升并发能力",
    );

    expect(performance).not.toBe(reliability);
  });
});
