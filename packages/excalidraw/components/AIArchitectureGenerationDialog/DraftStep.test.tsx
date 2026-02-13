import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import {
  editsAtom,
  fieldMappingAtom,
  importedCsvAtom,
} from "../AIArchitectureGeneration";

import { DraftStep } from "./DraftStep";

vi.mock("./hooks/useServiceNamingSuggestion", () => ({
  useServiceNamingSuggestion: () => ({
    requestSuggestions: vi.fn().mockResolvedValue(["checkout-core"]),
    isStreaming: false,
  }),
}));

describe("DraftStep", () => {
  it("renders groups and applies naming suggestion by user action", async () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "checkout-01",
            IP: "10.0.0.1",
            Service: "checkout",
            Env: "prod",
          },
          raw: {
            Host: "checkout-01",
            IP: "10.0.0.1",
            Service: "checkout",
            Env: "prod",
          },
        },
      ],
    });
    editorJotaiStore.set(fieldMappingAtom, {
      hostname: "Host",
      privateIp: "IP",
      serviceName: "Service",
      environment: "Env",
    });
    editorJotaiStore.set(editsAtom, {});

    const Harness = () => {
      const [suggestions, setSuggestions] = React.useState<Record<string, string[]>>(
        {},
      );
      return (
        <DraftStep
          onContinueCalibrate={() => {}}
          filter=""
          onFilterChange={() => {}}
          suggestions={suggestions}
          onSuggestionsChange={setSuggestions}
        />
      );
    };

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <Harness />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText("Draft 预览")).toBeInTheDocument();
    expect(screen.getAllByText("checkout").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("AI 命名建议"));

    await waitFor(() =>
      expect(screen.getByText("checkout-core")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("应用"));

    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[1]?.serviceName).toBe("checkout-core");
  });
});

