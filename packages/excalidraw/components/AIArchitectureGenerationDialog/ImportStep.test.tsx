import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import { importedCsvAtom } from "../AIArchitectureGeneration";

import { ImportStep } from "./ImportStep";

describe("ImportStep", () => {
  it("shows parse error for invalid csv input", () => {
    editorJotaiStore.set(importedCsvAtom, { headers: [], rows: [] });
    const onContinue = vi.fn();
    const onGenerateDraft = vi.fn();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ImportStep onContinue={onContinue} onGenerateDraft={onGenerateDraft} />
      </EditorJotaiProvider>,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "解析并进入字段确认" }));

    expect(screen.getByText("请输入 CSV 内容")).toBeInTheDocument();
    expect(onGenerateDraft).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("shows quality summary and preview grid after csv parse", () => {
    editorJotaiStore.set(importedCsvAtom, { headers: [], rows: [] });
    const onContinue = vi.fn();

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ImportStep onContinue={onContinue} onGenerateDraft={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Host,IP\nweb-01,10.0.0.1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "解析并进入字段确认" }));

    expect(screen.getByText(/数据质量卡/)).toBeInTheDocument();
    expect(screen.getByText(/必填字段命中率/)).toBeInTheDocument();
    expect(
      container.querySelector(".ai-architecture-generation-dialog__ag-grid"),
    ).toBeInTheDocument();
    expect(container.querySelector(".ag-root-wrapper")).toBeInTheDocument();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
