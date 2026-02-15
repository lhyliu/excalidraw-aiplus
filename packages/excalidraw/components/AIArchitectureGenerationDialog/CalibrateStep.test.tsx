import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import {
  completedCalibrationTaskIdsAtom,
  fieldMappingAtom,
  importedCsvAtom,
} from "../AIArchitectureGeneration";

import { CalibrateStep } from "./CalibrateStep";

describe("CalibrateStep", () => {
  it("renders confirmed state when quality gate passes", () => {
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
    editorJotaiStore.set(completedCalibrationTaskIdsAtom, []);

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <CalibrateStep onInsertToCanvas={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText(/confirmed/i).length).toBeGreaterThan(0);
  });

  it("renders quality gate panel when gate is blocked", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service"],
      rows: [
        {
          rowId: 1,
          values: { Host: "web-01", IP: "", Service: "checkout" },
          raw: { Host: "web-01", IP: "", Service: "checkout" },
        },
      ],
    });
    editorJotaiStore.set(fieldMappingAtom, {
      hostname: "Host",
      privateIp: "IP",
      serviceName: "Service",
    });
    editorJotaiStore.set(completedCalibrationTaskIdsAtom, []);

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <CalibrateStep onInsertToCanvas={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(container.querySelector(".ai-architecture-generation-dialog__issue-card")).toBeTruthy();
  });
});
