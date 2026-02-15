import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CsvFixPage } from "./CsvFixPage";

vi.mock("../../AIArchitectureGenerationDialog/ImportStep", () => ({
  ImportStep: () => <div>IMPORT_STEP</div>,
}));

vi.mock("../../AIArchitectureGenerationDialog/FieldMappingStep", () => ({
  FieldMappingStep: () => <div>FIELD_STEP</div>,
}));

vi.mock("../../AIArchitectureGenerationDialog/GuidedWorkspaceStep", () => ({
  GuidedWorkspaceStep: () => <div>ISSUE_STEP</div>,
}));

describe("CsvFixPage", () => {
  it("renders compact status bar and current stage", () => {
    render(
      <CsvFixPage
        step="fieldConfirm"
        hasSourceData
        hasRequiredMapping={false}
        blockingErrorCount={2}
        totalIssueCount={8}
        resolvedIssueCount={3}
        issueFilter={null}
        onContinueFieldConfirm={() => {}}
        onContinueIssueResolve={() => {}}
        onEnterDraftConfirm={() => {}}
        onJumpToStep={() => {}}
        onIssueFilterChange={() => {}}
      />,
    );

    expect(screen.getByText("步骤：")).toBeInTheDocument();
    expect(screen.getByText("修复：")).toBeInTheDocument();
    expect(screen.getByText("3/8（38%）")).toBeInTheDocument();
    expect(screen.getByText("阻断：")).toBeInTheDocument();
    expect(screen.getByText("FIELD_STEP")).toBeInTheDocument();
  });

  it("allows clicking reachable steps only", () => {
    const onJumpToStep = vi.fn();
    render(
      <CsvFixPage
        step="issueResolve"
        hasSourceData
        hasRequiredMapping
        blockingErrorCount={0}
        totalIssueCount={2}
        resolvedIssueCount={2}
        issueFilter={null}
        onContinueFieldConfirm={() => {}}
        onContinueIssueResolve={() => {}}
        onEnterDraftConfirm={() => {}}
        onJumpToStep={onJumpToStep}
        onIssueFilterChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "导入" }));
    fireEvent.click(screen.getByRole("button", { name: "字段确认" }));
    fireEvent.click(screen.getByRole("button", { name: "问题修复" }));

    expect(onJumpToStep).toHaveBeenCalledWith("ingest");
    expect(onJumpToStep).toHaveBeenCalledWith("fieldConfirm");
    expect(onJumpToStep).toHaveBeenCalledWith("issueResolve");
    expect(screen.getByRole("button", { name: "草图确认" })).toBeDisabled();
  });
});
