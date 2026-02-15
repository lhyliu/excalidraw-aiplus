import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const {
  mockCancelAiTask,
  mockSubscribeAllTaskStatuses,
  mockSession,
  mockSetSession,
  mockImportedCsvAtom,
  mockFieldMappingAtom,
  mockIssuesAtom,
  mockEditsAtom,
  mockConfidenceStateAtom,
  mockSessionAtom,
} = vi.hoisted(() => ({
  mockCancelAiTask: vi.fn(),
  mockSubscribeAllTaskStatuses: vi.fn(() => () => {}),
  mockSession: {
    step: "issueResolve",
    draftFilter: "",
    namingSuggestions: {},
    draftActiveScopeId: null,
    draftLayerEditsByScope: {},
    draftDiagramByScope: {},
    draftDiagramStatusByScope: {},
    issueFilter: null,
  },
  mockSetSession: vi.fn(),
  mockImportedCsvAtom: Symbol("importedCsvAtom"),
  mockFieldMappingAtom: Symbol("fieldMappingAtom"),
  mockIssuesAtom: Symbol("issuesAtom"),
  mockEditsAtom: Symbol("editsAtom"),
  mockConfidenceStateAtom: Symbol("confidenceStateAtom"),
  mockSessionAtom: Symbol("aiArchitectureGenerationSessionAtom"),
}));

vi.mock("../services/aiTaskService", () => ({
  cancelAiTask: mockCancelAiTask,
  listTaskStatuses: () => [
    {
      taskId: "task_1",
      mode: "remote",
      type: "service_name_fill",
      status: "running",
      current: 1,
      total: 2,
      updatedAt: Date.now(),
      message: "streaming",
    },
  ],
  subscribeAllTaskStatuses: mockSubscribeAllTaskStatuses,
}));

vi.mock("../i18n", () => ({
  t: (key: string) => {
    const dict: Record<string, string> = {
      "labels.aiTaskCenterTitle": "Recent tasks",
      "labels.aiTaskTypeServiceNameFill": "Service name fill",
      "labels.aiTaskStatusRunning": "Running",
      "labels.aiTaskActionCancel": "Cancel",
      "labels.aiTaskTypeUnknown": "Unknown task",
    };
    return dict[key] ?? key;
  },
}));

vi.mock("./Dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
}));

vi.mock("./pages/ai/CsvFixPage", () => ({
  CsvFixPage: () => <div>CSV_FIX_PAGE</div>,
}));

vi.mock("./pages/ai/DraftConfirmPage", () => ({
  DraftConfirmPage: () => <div>DRAFT_CONFIRM_PAGE</div>,
}));

vi.mock("./AIArchitectureGeneration", () => ({
  importedCsvAtom: mockImportedCsvAtom,
  fieldMappingAtom: mockFieldMappingAtom,
  issuesAtom: mockIssuesAtom,
  editsAtom: mockEditsAtom,
  confidenceStateAtom: mockConfidenceStateAtom,
  inferFieldCandidates: () => ({
    hostname: ["hostname"],
    privateIp: ["private_ip"],
    serviceName: ["service_name"],
  }),
  buildInitialFieldMapping: () => ({
    hostname: "hostname",
    privateIp: "private_ip",
    serviceName: "service_name",
  }),
}));

vi.mock("./AIArchitectureGenerationDialog/sessionState", () => ({
  aiArchitectureGenerationSessionAtom: mockSessionAtom,
}));

vi.mock("../editor-jotai", () => ({
  useAtom: (atom: unknown) => {
    if (atom === mockSessionAtom) {
      return [mockSession, mockSetSession];
    }
    return [undefined, vi.fn()];
  },
  useAtomValue: (atom: unknown) => {
    if (atom === mockImportedCsvAtom) {
      return { headers: ["hostname", "private_ip", "service_name"], rows: [{ rowId: 1 }] };
    }
    if (atom === mockFieldMappingAtom) {
      return {
        hostname: "hostname",
        privateIp: "private_ip",
        serviceName: "service_name",
      };
    }
    if (atom === mockIssuesAtom) {
      return [];
    }
    if (atom === mockEditsAtom) {
      return {};
    }
    if (atom === mockConfidenceStateAtom) {
      return {};
    }
    return undefined;
  },
}));

import { AIArchitectureGenerationPages } from "./AIArchitectureGenerationPages";

describe("AIArchitectureGenerationPages", () => {
  it("renders task banner with progress and supports cancel action", () => {
    render(<AIArchitectureGenerationPages onClose={() => {}} />);

    expect(screen.getByText("Recent tasks")).toBeInTheDocument();
    expect(screen.getByText("Service name fill")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("streaming")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "问题修复" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "草图确认" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockCancelAiTask).toHaveBeenCalledWith("task_1");
  });
});
