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
  it("restores step/mode/filter/suggestions from v3 session atom", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "draftConfirm",
      mode: "advanced",
      draftFilter: "checkout",
      namingSuggestions: {
        "group:checkout": ["checkout-core"],
      },
      version: 3,
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
        <AIArchitectureGenerationDialog onClose={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText(/Mode: Expert|模式: 专家/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "草图生成与确认" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("按服务名筛选")).toHaveValue("checkout");
  });

  it("allows navigating by clicking stepper items", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "fieldConfirm",
      mode: "safe",
      draftFilter: "",
      namingSuggestions: {},
      version: 3,
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
        <AIArchitectureGenerationDialog onClose={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "字段确认" }));
    expect(
      screen.getByRole("heading", { level: 3, name: "字段确认" }),
    ).toBeInTheDocument();
  });

  it("blocks issueResolve step navigation when required mapping is missing", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "fieldConfirm",
      mode: "safe",
      draftFilter: "",
      namingSuggestions: {},
      version: 3,
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
      hostname: "",
      privateIp: "",
      serviceName: "",
    });

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <AIArchitectureGenerationDialog onClose={() => {}} />
      </EditorJotaiProvider>,
    );

    const issueResolveButton = screen.getByRole("button", { name: "问题修复" });
    expect(issueResolveButton).toBeDisabled();
    expect(issueResolveButton.getAttribute("title")).toMatch(
      /required columns|关键字段/,
    );
  });

  it("blocks draftConfirm step navigation when blocking issues exist", () => {
    const session: AIArchitectureGenerationSessionState = {
      step: "issueResolve",
      mode: "safe",
      draftFilter: "",
      namingSuggestions: {},
      version: 3,
    };
    editorJotaiStore.set(aiArchitectureGenerationSessionAtom, session);
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service"],
      rows: [
        {
          rowId: 1,
          values: { Host: "web-01", IP: "invalid-ip", Service: "checkout" },
          raw: { Host: "web-01", IP: "invalid-ip", Service: "checkout" },
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
        <AIArchitectureGenerationDialog onClose={() => {}} />
      </EditorJotaiProvider>,
    );

    const draftConfirmButton = screen.getByRole("button", { name: "草图确认" });
    expect(draftConfirmButton).toBeDisabled();
    expect(draftConfirmButton.getAttribute("title")).toMatch(
      /blocking issues|阻断问题/,
    );
  });
});
