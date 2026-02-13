import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import { fieldMappingAtom, importedCsvAtom } from "../AIArchitectureGeneration";

import { AIArchitectureGenerationDialog } from "../AIArchitectureGenerationDialog";
import {
  aiArchitectureGenerationSessionAtom,
  type AIArchitectureGenerationSessionState,
} from "./sessionState";

vi.mock("../Dialog", () => ({
  Dialog: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
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

describe("AIArchitectureGenerationDialog session restore", () => {
  it("restores step/mode/filter/suggestions from session atom", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "draft",
      mode: "advanced",
      draftFilter: "checkout",
      namingSuggestions: {
        "group:checkout": ["checkout-core"],
      },
    };
    editorJotaiStore.set(aiArchitectureGenerationSessionAtom, session);
    editorJotaiStore.set(importedCsvAtom, {
      headers: [],
      rows: [],
    });

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <AIArchitectureGenerationDialog onClose={() => { }} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText(/Mode: Expert|模式: 专家/)).toBeInTheDocument();
    expect(screen.getByText("Draft 预览")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("按服务名筛选")).toHaveValue("checkout");
  });

  it("allows navigating by clicking left stepper items", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "workspace",
      mode: "safe",
      draftFilter: "",
      namingSuggestions: {},
      version: 2,
    };
    editorJotaiStore.set(aiArchitectureGenerationSessionAtom, session);
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Owner"],
      rows: [
        {
          rowId: 1,
          values: { Host: "web-01", IP: "10.0.0.1", Owner: "team-a" },
          raw: { Host: "web-01", IP: "10.0.0.1", Owner: "team-a" },
        },
      ],
    });

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <AIArchitectureGenerationDialog onClose={() => { }} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /数据工作台/ }));
    expect(screen.getByText("实时校准工作台")).toBeInTheDocument();
  });

  it("blocks calibrate step navigation when required mapping is missing", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "workspace",
      mode: "safe",
      draftFilter: "",
      namingSuggestions: {},
      version: 2,
    };
    editorJotaiStore.set(aiArchitectureGenerationSessionAtom, session);
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service"],
      rows: [
        {
          rowId: 1,
          values: { Host: "web-01", IP: "10.0.0.1", Service: "checkout" },
          raw: { Host: "web-01", IP: "10.0.0.1", Service: "checkout" },
        },
      ],
    });
    editorJotaiStore.set(fieldMappingAtom, {});

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <AIArchitectureGenerationDialog onClose={() => { }} />
      </EditorJotaiProvider>,
    );

    const calibrateButton = screen.getByRole("button", { name: "可信现状" });
    expect(calibrateButton).toBeDisabled();
    expect(calibrateButton.getAttribute("title")).toMatch(
      /Please confirm required columns|No calibratable assets found|请先确认关键列|当前没有可校准资产/,
    );
  });

  it("allows entering calibrate step after required mapping is provided", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "workspace",
      mode: "safe",
      draftFilter: "",
      namingSuggestions: {},
      version: 2,
    };
    editorJotaiStore.set(aiArchitectureGenerationSessionAtom, session);
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service"],
      rows: [
        {
          rowId: 1,
          values: { Host: "web-01", IP: "10.0.0.1", Service: "checkout" },
          raw: { Host: "web-01", IP: "10.0.0.1", Service: "checkout" },
        },
      ],
    });
    editorJotaiStore.set(fieldMappingAtom, {
      hostname: "Host",
      privateIp: "IP",
      serviceName: "Service",
    });

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <AIArchitectureGenerationDialog onClose={() => { }} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "可信现状" }));
    expect(screen.getByText("AI 校准")).toBeInTheDocument();
  });

});
