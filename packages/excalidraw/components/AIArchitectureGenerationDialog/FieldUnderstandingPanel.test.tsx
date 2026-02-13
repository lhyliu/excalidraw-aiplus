import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { FieldInferenceResult, FieldMapping } from "../AIArchitectureGeneration";

import { FieldUnderstandingPanel } from "./FieldUnderstandingPanel";

describe("FieldUnderstandingPanel", () => {
  it("shows AI suggestion action for low-confidence fields and triggers callback", () => {
    const onStartEdit = vi.fn();
    const onChangeMapping = vi.fn();
    const onRequestAISuggestion = vi.fn();
    const inferred: FieldInferenceResult = {
      hostname: [
        {
          field: "hostname",
          header: "Host",
          score: 0.95,
          reason: "exact alias match",
        },
      ],
      serviceName: [
        {
          field: "serviceName",
          header: "Owner",
          score: 0.4,
          reason: "weak signal",
        },
      ],
    };
    const mapping: FieldMapping = {
      hostname: "Host",
    };

    render(
      <FieldUnderstandingPanel
        fields={["hostname", "serviceName"]}
        inferred={inferred}
        mapping={mapping}
        headers={["Host", "Owner"]}
        editingField={null}
        onStartEdit={onStartEdit}
        onChangeMapping={onChangeMapping}
        onRequestAISuggestion={onRequestAISuggestion}
        aiSuggestingField={null}
      />,
    );

    expect(screen.getByRole("button", { name: "AI 建议列名" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI 建议列名" }));
    expect(onRequestAISuggestion).toHaveBeenCalledWith("serviceName");
  });
});

