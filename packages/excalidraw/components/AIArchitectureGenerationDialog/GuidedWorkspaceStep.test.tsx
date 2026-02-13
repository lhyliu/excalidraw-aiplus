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

const inferMissingServiceNamesMock = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useServiceSemanticSuggestion", () => ({
  useServiceSemanticSuggestion: () => ({
    inferMissingServiceNames: inferMissingServiceNamesMock,
    isStreaming: false,
  }),
}));

describe("GuidedWorkspaceStep", () => {
  inferMissingServiceNamesMock.mockImplementation(async (rows: Array<{ rowId: number }>) =>
    rows.map((item) => ({
      rowId: item.rowId,
      serviceName: "OMS数据库",
      reason: "命中DB语义",
    })),
  );

  it("renders issue resolution workspace and applies grouped fix", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "web-01",
            IP: "10.0.0.1",
            Service: "checkout",
            Env: "SVR_aCloud",
          },
          raw: {
            Host: "web-01",
            IP: "10.0.0.1",
            Service: "checkout",
            Env: "SVR_aCloud",
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
        <GuidedWorkspaceStep onContinueDraft={() => {}} onOpenExpert={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText("问题修复工作台")).toBeInTheDocument();
    expect(screen.getByText(/待修复问题/)).toBeInTheDocument();
    expect(screen.getByText("问题分组修复")).toBeInTheDocument();
    expect(
      container.querySelector(".ai-architecture-generation-dialog__ag-grid"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("待确认值"), {
      target: { value: "production" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用到该类问题" }));

    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[1]?.environment).toBe("production");
  });

  it("fills missing service names by AI semantic suggestion", async () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "oms-db-01",
            IP: "10.0.0.11",
            Service: "",
            Env: "production",
          },
          raw: {
            Host: "oms-db-01",
            IP: "10.0.0.11",
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
        <GuidedWorkspaceStep onContinueDraft={() => {}} onOpenExpert={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI识别服务名称" }));

    await screen.findByText(/已应用 AI 机器用途识别/);
    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[1]?.serviceName).toBe("OMS数据库");
  });

  it("shows per-cell AI action for empty serviceName and fills single row", async () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 9,
          values: {
            Host: "edge-waf-01",
            IP: "10.0.0.90",
            Service: "",
            Env: "production",
          },
          raw: {
            Host: "edge-waf-01",
            IP: "10.0.0.90",
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
        <GuidedWorkspaceStep onContinueDraft={() => {}} onOpenExpert={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI识别服务名称 row 9" }));

    await screen.findByText(/已应用 AI 单条识别/);
    const updatedCellValue = screen.getByText("OMS数据库");
    expect(updatedCellValue.closest(".ag-cell") ?? updatedCellValue.closest("td")).toHaveClass(
      "ai-architecture-generation-dialog__cell-ai-updated",
    );
    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[9]?.serviceName).toBe("OMS数据库");
  });

  it("shows loading state after clicking single-cell AI button", async () => {
    let resolveSuggestion: ((value: Array<{ rowId: number; serviceName: string; reason: string }>) => void) | null =
      null;
    inferMissingServiceNamesMock.mockImplementationOnce(
      () =>
        new Promise<Array<{ rowId: number; serviceName: string; reason: string }>>(
          (resolve) => {
            resolveSuggestion = resolve;
          },
        ),
    );

    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 9,
          values: {
            Host: "edge-waf-01",
            IP: "10.0.0.90",
            Service: "",
            Env: "production",
          },
          raw: {
            Host: "edge-waf-01",
            IP: "10.0.0.90",
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
        <GuidedWorkspaceStep onContinueDraft={() => {}} onOpenExpert={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI识别服务名称 row 9" }));

    const cellButton = screen.getByRole("button", { name: "AI识别服务名称 row 9" });
    expect(cellButton).toHaveTextContent("识别中...");
    expect(cellButton).toBeDisabled();

    const headerButton = screen.getByRole("button", { name: "AI识别服务名称" });
    expect(headerButton).toBeDisabled();

    resolveSuggestion?.([{ rowId: 9, serviceName: "WAF防火墙", reason: "命中waf语义" }]);
    await screen.findByText(/已应用 AI 单条识别/);
  });
});
