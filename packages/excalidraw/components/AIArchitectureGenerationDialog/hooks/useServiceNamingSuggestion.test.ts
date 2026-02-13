import { describe, expect, it } from "vitest";

import { parseServiceNameSuggestions } from "./useServiceNamingSuggestion";

describe("parseServiceNameSuggestions", () => {
  it("parses json suggestions", () => {
    const raw = JSON.stringify({
      suggestions: ["checkout-core", "checkout-api"],
    });
    expect(parseServiceNameSuggestions(raw)).toEqual([
      "checkout-core",
      "checkout-api",
    ]);
  });

  it("falls back to line parsing", () => {
    const raw = "- checkout-core\n- checkout-api\nextra";
    expect(parseServiceNameSuggestions(raw)).toEqual([
      "checkout-core",
      "checkout-api",
      "extra",
    ]);
  });
});

