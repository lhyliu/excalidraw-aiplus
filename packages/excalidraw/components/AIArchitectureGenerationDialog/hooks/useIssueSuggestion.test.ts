import { describe, expect, it } from "vitest";

import { parseIssueSuggestion } from "./useIssueSuggestion";

describe("parseIssueSuggestion", () => {
  it("parses json payload", () => {
    const parsed = parseIssueSuggestion(
      JSON.stringify({
        suggestedValue: "checkout",
        reason: "hostname prefix",
      }),
    );
    expect(parsed).toEqual({
      suggestedValue: "checkout",
      reason: "hostname prefix",
    });
  });

  it("falls back to first line", () => {
    const parsed = parseIssueSuggestion("checkout\nreason text");
    expect(parsed.suggestedValue).toBe("checkout");
  });
});
