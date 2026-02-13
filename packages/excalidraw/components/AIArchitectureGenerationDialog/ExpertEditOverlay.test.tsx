import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import {
  editsAtom,
  fieldMappingAtom,
  ignoredRowsAtom,
  importedCsvAtom,
} from "../AIArchitectureGeneration";

import { ExpertEditOverlay } from "./ExpertEditOverlay";

describe("ExpertEditOverlay", () => {
  it("asks confirmation when canceling dirty edits", () => {
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
    editorJotaiStore.set(editsAtom, {});
    editorJotaiStore.set(ignoredRowsAtom, []);

    const onSave = vi.fn();
    const onCancel = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ExpertEditOverlay onSave={onSave} onCancel={onCancel} />
      </EditorJotaiProvider>,
    );

    fireEvent.change(screen.getByDisplayValue("web-01"), {
      target: { value: "web-02" },
    });
    fireEvent.click(screen.getByText("取消"));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls save callback from footer action", () => {
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
    editorJotaiStore.set(editsAtom, {});
    editorJotaiStore.set(ignoredRowsAtom, []);

    const onSave = vi.fn();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ExpertEditOverlay onSave={onSave} onCancel={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.click(screen.getByText("保存并返回 AI 校准"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("supports undo and restore snapshot in expert mode", () => {
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
    editorJotaiStore.set(editsAtom, {});
    editorJotaiStore.set(ignoredRowsAtom, []);

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ExpertEditOverlay onSave={() => {}} onCancel={() => {}} />
      </EditorJotaiProvider>,
    );

    fireEvent.change(screen.getByDisplayValue("web-01"), {
      target: { value: "web-02" },
    });
    expect(editorJotaiStore.get(editsAtom)[1]?.hostname).toBe("web-02");

    fireEvent.click(screen.getByText("撤销上一步"));
    expect(editorJotaiStore.get(editsAtom)[1]?.hostname).toBeUndefined();

    fireEvent.change(screen.getByDisplayValue("web-01"), {
      target: { value: "web-03" },
    });
    expect(editorJotaiStore.get(editsAtom)[1]?.hostname).toBe("web-03");

    fireEvent.click(screen.getByText("恢复进入前状态"));
    expect(editorJotaiStore.get(editsAtom)[1]?.hostname).toBeUndefined();
  });
});


