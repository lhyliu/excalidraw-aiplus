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
        <FieldMappingStep onContinue={onContinue} onGenerateDraft={() => { }} />
      </EditorJotaiProvider>,
    );

    // Section header should show field confirmation prompts
    expect(screen.getByText(/仅需你确认/)).toBeInTheDocument();
    expect(screen.getByText(/画图必需字段覆盖/)).toBeInTheDocument();
    expect(screen.getByText(/展开可选字段（可忽略）/)).toBeInTheDocument();

    // Confidence and reason badges should be visible
    expect(screen.getAllByText(/匹配|contains|包含|no alias/i).length).toBeGreaterThan(0);

    // Click the primary confirm button
    fireEvent.click(screen.getByRole("button", { name: /确认并进入问题修复/ }));

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
        <FieldMappingStep onContinue={onContinue} onGenerateDraft={() => { }} />
      </EditorJotaiProvider>,
    );

    // Inline selects are always visible now — find the serviceName combobox
    const selects = screen.getAllByRole("combobox");
    // The serviceName field should have the manual option — find it
    const serviceNameSelect = selects.find((select) =>
      Array.from(select.querySelectorAll("option")).some(
        (opt) => opt.value === "__manual__serviceName",
      ),
    );
    expect(serviceNameSelect).toBeTruthy();
    fireEvent.change(serviceNameSelect!, {
      target: { value: "__manual__serviceName" },
    });
    fireEvent.click(screen.getByRole("button", { name: /确认并进入问题修复/ }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    const aliases = editorJotaiStore.get(aliasStoreAtom);
    expect(aliases.serviceName ?? []).toEqual([]);
  });
});


