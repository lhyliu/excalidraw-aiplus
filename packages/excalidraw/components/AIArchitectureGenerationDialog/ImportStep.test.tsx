import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import { importedCsvAtom } from "../AIArchitectureGeneration";

import { ImportStep } from "./ImportStep";

describe("ImportStep", () => {
  it("allows generating draft directly after csv parse", () => {
    editorJotaiStore.set(importedCsvAtom, { headers: [], rows: [] });
    const onContinue = vi.fn();
    const onGenerateDraft = vi.fn();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ImportStep onContinue={onContinue} onGenerateDraft={onGenerateDraft} />
      </EditorJotaiProvider>,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Host,IP\nweb-01,10.0.0.1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "解析 CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "一键生成初稿" }));

    expect(onGenerateDraft).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("renders ag-grid preview after csv parse", () => {
    editorJotaiStore.set(importedCsvAtom, { headers: [], rows: [] });

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ImportStep onContinue={() => {}} onGenerateDraft={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Host,IP\nweb-01,10.0.0.1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "解析 CSV" }));

    expect(
      container.querySelector(".ai-architecture-generation-dialog__ag-grid"),
    ).toBeInTheDocument();
    expect(container.querySelector(".ag-root-wrapper")).toBeInTheDocument();
  });
});
