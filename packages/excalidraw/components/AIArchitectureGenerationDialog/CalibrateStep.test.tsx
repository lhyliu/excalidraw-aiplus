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
  it("shows confirmed when quality gate is passed", () => {
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
        <CalibrateStep />
      </EditorJotaiProvider>,
    );

    expect(
      screen.getByText("已标记为可信现状（confirmed）"),
    ).toBeInTheDocument();
  });

  it("shows gate blocking reasons when quality threshold is not met", () => {
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

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <CalibrateStep />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText("质量门槛: 未通过")).toBeInTheDocument();
    expect(screen.getByText("可信现状阻断原因")).toBeInTheDocument();
    expect(
      screen.queryByText("已标记为可信现状（confirmed）"),
    ).not.toBeInTheDocument();
  });
});

