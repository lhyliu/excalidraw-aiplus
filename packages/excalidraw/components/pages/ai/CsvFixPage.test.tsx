import { render, screen } from "@testing-library/react";
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
  it("renders current stage content", () => {
    render(
      <CsvFixPage
        step="fieldConfirm"
        issueFilter={null}
        readOnly={false}
        onContinueFieldConfirm={() => {}}
        onContinueIssueResolve={() => {}}
        onEnterDraftConfirm={() => {}}
        onIssueFilterChange={() => {}}
      />,
    );

    expect(screen.getByText("FIELD_STEP")).toBeInTheDocument();
  });

  it("shows read-only banner when readOnly is enabled", () => {
    render(
      <CsvFixPage
        step="issueResolve"
        issueFilter={null}
        readOnly
        readOnlyReason="请先修复阻断问题"
        onContinueFieldConfirm={() => {}}
        onContinueIssueResolve={() => {}}
        onEnterDraftConfirm={() => {}}
        onIssueFilterChange={() => {}}
      />,
    );

    expect(screen.getByText("当前为只读预览：请先修复阻断问题")).toBeInTheDocument();
  });
});