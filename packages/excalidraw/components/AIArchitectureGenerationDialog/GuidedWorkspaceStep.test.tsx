import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import {
  editsAtom,
  fieldMappingAtom,
  importedCsvAtom,
} from "../AIArchitectureGeneration";

import { GuidedWorkspaceStep } from "./GuidedWorkspaceStep";

vi.mock("./hooks/useServiceSemanticSuggestion", () => ({
  useServiceSemanticSuggestion: () => ({
    inferMissingServiceNames: vi.fn(),
    isStreaming: false,
  }),
}));

describe("GuidedWorkspaceStep", () => {
  it("renders simplified workspace and removes legacy toolbar actions", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "web-01",
            IP: "10.0.0.1",
            Service: "checkout",
            Env: "prod",
          },
          raw: {
            Host: "web-01",
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

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <GuidedWorkspaceStep
          onContinueDraft={() => { }}
          activeIssueFilterKey={null}
          onActiveIssueFilterKeyChange={() => {}}
        />
      </EditorJotaiProvider>,
    );

    expect(container.querySelector(".ai-architecture-generation-dialog__issue-strip")).toBeTruthy();
    expect(container.querySelector(".ai-architecture-generation-dialog__workspace-table")).toBeTruthy();
    expect(container.querySelector(".ai-architecture-generation-dialog__ag-grid")).toBeTruthy();

    expect(screen.queryByText("批量填充")).not.toBeInTheDocument();
    expect(screen.queryByText("批量应用 AI 建议")).not.toBeInTheDocument();
    expect(screen.queryByText("批量忽略")).not.toBeInTheDocument();
    expect(screen.queryByText("取消忽略")).not.toBeInTheDocument();
    expect(screen.queryByText("一键补全空服务名 (AI)")).not.toBeInTheDocument();
    expect(screen.queryByText("批量编辑")).not.toBeInTheDocument();
  });

  it("keeps only fullscreen icon action in toolbar", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "web-01",
            IP: "10.0.0.1",
            Service: "",
            Env: "production",
          },
          raw: {
            Host: "web-01",
            IP: "10.0.0.1",
            Service: "",
            Env: "production",
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

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <GuidedWorkspaceStep
          onContinueDraft={() => { }}
          activeIssueFilterKey={null}
          onActiveIssueFilterKeyChange={() => {}}
        />
      </EditorJotaiProvider>,
    );

    const fullscreenButton = screen.getByLabelText("进入全屏编辑");
    fireEvent.click(fullscreenButton);
    expect(screen.getByLabelText("退出全屏编辑")).toBeInTheDocument();
  });
});
