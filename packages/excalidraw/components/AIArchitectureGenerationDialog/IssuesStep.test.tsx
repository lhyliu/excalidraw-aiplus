import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import {
  editsAtom,
  fieldMappingAtom,
  ignoredRowsAtom,
  importedCsvAtom,
} from "../AIArchitectureGeneration";

import { IssuesStep } from "./IssuesStep";

describe("IssuesStep", () => {
  it("renders calibration task flow and applies issue fix into edits", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service", "Env"],
      rows: [
        {
          rowId: 1,
          values: {
            Host: "web-01",
            IP: "abc",
            Service: "checkout",
            Env: "prod",
          },
          raw: {
            Host: "web-01",
            IP: "abc",
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
    editorJotaiStore.set(ignoredRowsAtom, []);
    editorJotaiStore.set(editsAtom, {});

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <IssuesStep onOpenExpert={() => {}} onContinueDraft={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText("当前校准任务")).toBeInTheDocument();
    expect(screen.getAllByText("机器用途待确认").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "预览涉及的主机" }));
    fireEvent.change(screen.getByPlaceholderText("修正值"), {
      target: { value: "10.0.0.1" },
    });
    fireEvent.click(screen.getByText("应用"));

    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[1]?.privateIp).toBe("10.0.0.1");
  });

  it("supports batch apply for grouped pending confirmations", () => {
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
        {
          rowId: 2,
          values: {
            Host: "web-02",
            IP: "10.0.0.2",
            Service: "checkout",
            Env: "SVR_aCloud",
          },
          raw: {
            Host: "web-02",
            IP: "10.0.0.2",
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
    editorJotaiStore.set(ignoredRowsAtom, []);
    editorJotaiStore.set(editsAtom, {});

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <IssuesStep onOpenExpert={() => {}} onContinueDraft={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText("待确认事项（1 类）")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "生产（production）" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("环境建议值"), {
      target: { value: "production" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认并应用 (2)" }));

    const edits = editorJotaiStore.get(editsAtom);
    expect(edits[1]?.environment).toBe("production");
    expect(edits[2]?.environment).toBe("production");
  });
});

