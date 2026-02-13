import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider, editorJotaiStore } from "../../editor-jotai";
import {
  aliasStoreAtom,
  fieldMappingAtom,
  importedCsvAtom,
} from "../AIArchitectureGeneration";

import { FieldMappingStep } from "./FieldMappingStep";

describe("FieldMappingStep", () => {
  it("shows AI understanding with inference reason and remembers aliases", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host Name", "IP Address", "Service"],
      rows: [
        {
          rowId: 1,
          values: {
            "Host Name": "web-01",
            "IP Address": "10.0.0.1",
            Service: "checkout",
          },
          raw: {
            "Host Name": "web-01",
            "IP Address": "10.0.0.1",
            Service: "checkout",
          },
        },
      ],
    });
    editorJotaiStore.set(fieldMappingAtom, {});
    editorJotaiStore.set(aliasStoreAtom, {});
    const onContinue = vi.fn();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <FieldMappingStep onContinue={onContinue} onGenerateDraft={() => {}} />
      </EditorJotaiProvider>,
    );

    expect(screen.getByText("读懂你的表格")).toBeInTheDocument();
    expect(screen.getByText(/仅需你确认/)).toBeInTheDocument();
    expect(screen.getByText(/画图必需字段覆盖/)).toBeInTheDocument();
    expect(screen.getByText("展开可选字段（可忽略）")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/查看 AI 已确认字段/));
    expect(screen.getAllByText(/匹配|contains|包含|no alias/i).length).toBeGreaterThan(0);
    expect(screen.getByText("收起透视区")).toBeInTheDocument();

    fireEvent.click(screen.getByText("确认 AI 理解并继续"));

    expect(onContinue).toHaveBeenCalledTimes(1);
    const aliases = editorJotaiStore.get(aliasStoreAtom);
    expect(aliases.hostname).toContain("Host Name");
    expect(aliases.privateIp).toContain("IP Address");
    expect(aliases.serviceName).toContain("Service");
  });

  it("allows serviceName manual fill mode when source table has no service column", () => {
    editorJotaiStore.set(importedCsvAtom, {
      headers: ["Host Name", "IP Address", "Owner"],
      rows: [
        {
          rowId: 1,
          values: {
            "Host Name": "web-01",
            "IP Address": "10.0.0.1",
            Owner: "team-a",
          },
          raw: {
            "Host Name": "web-01",
            "IP Address": "10.0.0.1",
            Owner: "team-a",
          },
        },
      ],
    });
    editorJotaiStore.set(fieldMappingAtom, {});
    editorJotaiStore.set(aliasStoreAtom, {});
    const onContinue = vi.fn();

    render(
      <EditorJotaiProvider store={editorJotaiStore}>
        <FieldMappingStep onContinue={onContinue} onGenerateDraft={() => {}} />
      </EditorJotaiProvider>,
    );

    const chooseButtons = screen.getAllByRole("button", { name: "选择列名" });
    fireEvent.click(chooseButtons[0]);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "__manual__serviceName" },
    });
    fireEvent.click(screen.getByText("确认 AI 理解并继续"));

    expect(onContinue).toHaveBeenCalledTimes(1);
    const aliases = editorJotaiStore.get(aliasStoreAtom);
    expect(aliases.serviceName ?? []).toEqual([]);
  });
});

