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
        name: "入口层",
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

  const setupAtoms = () => {
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
  };

  const Harness = () => {
    const [suggestions, setSuggestions] = React.useState<Record<string, string[]>>({});
    const [activeScopeId, setActiveScopeId] = React.useState<string | null>(null);
    const [layerEditsByScope, setLayerEditsByScope] = React.useState<Record<string, { name: string; description: string; rowIds: number[]; reason: string }[]>>({});
    const [diagramByScope, setDiagramByScope] = React.useState<Record<string, string>>({});
    const [diagramStatusByScope, setDiagramStatusByScope] = React.useState<Record<string, "idle" | "generating" | "ready" | "error">>({});

    return (
      <DraftStep
        onContinueCalibrate={() => {}}
        onInsertToCanvas={() => {}}
        filter=""
        onFilterChange={() => {}}
        suggestions={suggestions}
        onSuggestionsChange={setSuggestions}
        activeScopeId={activeScopeId}
        onActiveScopeIdChange={setActiveScopeId}
        layerEditsByScope={layerEditsByScope}
        onLayerEditsByScopeChange={setLayerEditsByScope}
        diagramByScope={diagramByScope}
        onDiagramByScopeChange={setDiagramByScope}
        diagramStatusByScope={diagramStatusByScope}
        onDiagramStatusByScopeChange={setDiagramStatusByScope}
      />
    );
  };

  it("renders the new draft workflow layout", async () => {
    setupAtoms();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <Harness />
      </EditorJotaiProvider>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "草图生成与确认" })).toBeInTheDocument();
    expect(screen.getByText("架构图预览")).toBeInTheDocument();
    expect(screen.getByText("资产表")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI分析分层" })).toBeInTheDocument();
  });

  it("moves to layerReady then diagramReady path", async () => {
    setupAtoms();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <Harness />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI分析分层" }));
    await waitFor(() => {
      expect(requestBusinessArchitectureMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成架构图" }));
    await waitFor(() => {
      const insertBtn = screen.getByRole("button", { name: "确认插入画布" });
      expect(insertBtn).not.toBeDisabled();
    });
  });
});
