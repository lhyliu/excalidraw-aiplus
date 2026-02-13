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

    fireEvent.change(screen.getByPlaceholderText("批量填充值"), {
      target: { value: "统一服务-1" },
    });
    fireEvent.change(screen.getByLabelText("填充范围"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("覆盖策略"), {
      target: { value: "overwrite" },
    });
    fireEvent.click(screen.getByText("批量填充"));
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

    fireEvent.click(screen.getByText("保存并返回校准工作台"));
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

    fireEvent.change(screen.getByPlaceholderText("批量填充值"), {
      target: { value: "web-02" },
    });
    fireEvent.change(screen.getByLabelText("填充范围"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("覆盖策略"), {
      target: { value: "overwrite" },
    });
    fireEvent.click(screen.getByText("批量填充"));
    expect(editorJotaiStore.get(editsAtom)[1]?.serviceName).toBe("web-02");

    fireEvent.click(screen.getByText("撤销上一步"));
    expect(editorJotaiStore.get(editsAtom)[1]?.serviceName).toBeUndefined();

    fireEvent.change(screen.getByPlaceholderText("批量填充值"), {
      target: { value: "web-03" },
    });
    fireEvent.click(screen.getByText("批量填充"));
    expect(editorJotaiStore.get(editsAtom)[1]?.serviceName).toBe("web-03");

    fireEvent.click(screen.getByText("恢复进入前状态"));
    expect(editorJotaiStore.get(editsAtom)[1]?.serviceName).toBeUndefined();
  });

  it("supports scope and overwrite strategy for batch fill", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host", "IP", "Service"],
      rows: [
        {
          rowId: 1,
          values: { Host: "web-01", IP: "10.0.0.1", Service: "已有服务" },
          raw: { Host: "web-01", IP: "10.0.0.1", Service: "已有服务" },
        },
        {
          rowId: 2,
          values: { Host: "web-02", IP: "10.0.0.2", Service: "" },
          raw: { Host: "web-02", IP: "10.0.0.2", Service: "" },
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

    expect(screen.getByLabelText("填充范围")).toBeInTheDocument();
    expect(screen.getByLabelText("覆盖策略")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("批量填充值"), {
      target: { value: "统一服务" },
    });
    fireEvent.change(screen.getByLabelText("填充范围"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("覆盖策略"), {
      target: { value: "empty_only" },
    });
    fireEvent.click(screen.getByText("批量填充"));

    expect(editorJotaiStore.get(editsAtom)[1]?.serviceName).toBeUndefined();
    expect(editorJotaiStore.get(editsAtom)[2]?.serviceName).toBe("统一服务");

    fireEvent.change(screen.getByPlaceholderText("批量填充值"), {
      target: { value: "覆盖服务" },
    });
    fireEvent.change(screen.getByLabelText("覆盖策略"), {
      target: { value: "overwrite" },
    });
    fireEvent.click(screen.getByText("批量填充"));

    expect(editorJotaiStore.get(editsAtom)[1]?.serviceName).toBe("覆盖服务");
    expect(editorJotaiStore.get(editsAtom)[2]?.serviceName).toBe("覆盖服务");
  });

  it("renders ag-grid container in expert mode", () => {
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

    const { container } = render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <ExpertEditOverlay onSave={() => {}} onCancel={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(
      container.querySelector(".ai-architecture-generation-dialog__ag-grid"),
    ).toBeInTheDocument();
    expect(container.querySelector(".ag-root-wrapper")).toBeInTheDocument();
  });
});


