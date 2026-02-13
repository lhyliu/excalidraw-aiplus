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

const requestBusinessArchitectureMock = vi.hoisted(() => vi.fn());
const requestBusinessScopesMock = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useServiceNamingSuggestion", () => ({
  useServiceNamingSuggestion: () => ({
    requestSuggestions: vi.fn().mockResolvedValue(["checkout-core"]),
    isStreaming: false,
  }),
}));
vi.mock("./hooks/useBusinessArchitectureSuggestion", () => ({
  useBusinessArchitectureSuggestion: () => ({
    requestBusinessArchitecture: requestBusinessArchitectureMock,
    isStreaming: false,
  }),
}));
vi.mock("./hooks/useBusinessScopeSuggestion", () => ({
  useBusinessScopeSuggestion: () => ({
    requestBusinessScopes: requestBusinessScopesMock,
    isStreaming: false,
  }),
}));
vi.mock("../App", () => ({
  useApp: () => ({
    addElementsFromPasteOrLibrary: vi.fn(),
    setOpenDialog: vi.fn(),
  }),
}));
vi.mock("../../context/ui-appState", () => ({
  useUIAppState: () => ({
    theme: "light",
  }),
}));
vi.mock("../TTDDialog/common", () => ({
  convertMermaidToExcalidraw: vi.fn().mockResolvedValue({ success: true }),
  insertToEditor: vi.fn(),
}));
vi.mock("@excalidraw/mermaid-to-excalidraw", () => ({
  default: {
    parseMermaidToExcalidraw: vi.fn().mockResolvedValue({
      elements: [],
      files: null,
    }),
  },
  parseMermaidToExcalidraw: vi.fn().mockResolvedValue({
    elements: [],
    files: null,
  }),
}));

describe("DraftStep", () => {
  requestBusinessArchitectureMock.mockResolvedValue({
    summary: "订单业务链路",
    mermaid: "graph TD\nA[入口]-->B[应用]",
    layers: [
      {
        name: "入口区",
        description: "接入流量",
        reason: "hostname含gateway",
        rowIds: [1],
      },
    ],
  });
  requestBusinessScopesMock.mockResolvedValue({
    scopes: [
      {
        name: "订单业务",
        groupIds: ["group-0"],
        reason: "serviceName语义聚类",
      },
    ],
  });

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
          onContinueCalibrate={() => { }}
          filter=""
          onFilterChange={() => { }}
          suggestions={suggestions}
          onSuggestionsChange={setSuggestions}
        />
      );
    };

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <Harness />
      </EditorJotaiProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "草图生成与确认" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("当前业务范围")).toBeInTheDocument();
    expect(screen.queryByText("全选")).not.toBeInTheDocument();
    expect(screen.queryByText("清空")).not.toBeInTheDocument();
    expect(screen.getAllByText("checkout").length).toBeGreaterThan(0);
    expect(
      container.querySelector(".ai-architecture-generation-dialog__ag-grid"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("AI 命名建议"));

    await waitFor(() =>
      expect(screen.getByText("checkout-core")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("应用"));

    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[1]?.serviceName).toBe("checkout-core");
  });

  it("requests AI layering when user clicks analyze", async () => {
    requestBusinessArchitectureMock.mockResolvedValue({
      summary: "订单业务链路",
      mermaid: "graph TD\nA[入口]-->B[应用]",
      layers: [
        {
          name: "入口区",
          description: "接入流量",
          reason: "hostname含gateway",
          rowIds: [1],
        },
      ],
    });
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "gateway-01",
            IP: "10.0.0.1",
            Service: "gateway",
            Env: "prod",
          },
          raw: {
            Host: "gateway-01",
            IP: "10.0.0.1",
            Service: "gateway",
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
          onContinueCalibrate={() => { }}
          onInsertToCanvas={() => { }}
          filter=""
          onFilterChange={() => { }}
          suggestions={suggestions}
          onSuggestionsChange={setSuggestions}
        />
      );
    };

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <Harness />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI 分析分层" }));
    await waitFor(() => {
      expect(requestBusinessArchitectureMock).toHaveBeenCalledWith(
        "gateway",
        expect.any(Array),
        expect.any(Array),
      );
    });
  });

  it("shows AI inferred scope source and allows re-inference action", async () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "gateway-01",
            IP: "10.0.0.1",
            Service: "gateway",
            Env: "prod",
          },
          raw: {
            Host: "gateway-01",
            IP: "10.0.0.1",
            Service: "gateway",
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
          onContinueCalibrate={() => { }}
          onInsertToCanvas={() => { }}
          filter=""
          onFilterChange={() => { }}
          suggestions={suggestions}
          onSuggestionsChange={setSuggestions}
        />
      );
    };

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <Harness />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI 分析分层" }));
    await waitFor(() => {
      expect(screen.getByText("来源: AI 推断")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 重新识别范围" }));
    await waitFor(() => {
      expect(requestBusinessScopesMock).toHaveBeenCalled();
    });
  });
});

