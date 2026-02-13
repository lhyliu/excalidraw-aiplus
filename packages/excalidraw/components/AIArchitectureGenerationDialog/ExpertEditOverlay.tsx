import React, { useCallback, useMemo, useState } from "react";
import {
  type CellValueChangedEvent,
  type ColDef,
  type SelectionChangedEvent,
} from "ag-grid-community";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  editsAtom,
  ignoredRowsAtom,
  normalizedVmRowsAtom,
} from "../AIArchitectureGeneration";
import type { StandardField } from "../AIArchitectureGeneration";
import { SharedAgGrid } from "./SharedAgGrid";

interface ExpertEditOverlayProps {
  onSave: () => void;
  onCancel: () => void;
}

const editableFields: StandardField[] = [
  "hostname",
  "privateIp",
  "serviceName",
  "environment",
  "cpuCores",
  "memoryGb",
  "cluster",
  "region",
];

type OverlayGridRow = Record<StandardField, string> & {
  rowId: number;
};

const isEmptyForBatchFill = (field: StandardField, value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  if (field === "serviceName" && normalized === "unknown") {
    return true;
  }
  return false;
};

export const ExpertEditOverlay: React.FC<ExpertEditOverlayProps> = ({
  onSave,
  onCancel,
}) => {
  const rows = useAtomValue(normalizedVmRowsAtom);
  const [edits, setEdits] = useAtom(editsAtom);
  const [ignoredRows, setIgnoredRows] = useAtom(ignoredRowsAtom);
  const [initialEdits] = useState(() => JSON.stringify(edits));
  const [initialIgnoredRows] = useState(() => JSON.stringify(ignoredRows));
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [batchField, setBatchField] = useState<StandardField>("serviceName");
  const [batchValue, setBatchValue] = useState("");
  const [batchScope, setBatchScope] = useState<"selected" | "all">("selected");
  const [batchStrategy, setBatchStrategy] = useState<"empty_only" | "overwrite">(
    "empty_only",
  );
  const [history, setHistory] = useState<Array<{ edits: typeof edits; ignoredRows: number[] }>>(
    [],
  );

  const rowData = useMemo<OverlayGridRow[]>(
    () =>
      rows.map((row) => ({
        rowId: row.rowId,
        hostname: String(edits[row.rowId]?.hostname ?? row.vm.hostname ?? ""),
        privateIp: String(edits[row.rowId]?.privateIp ?? row.vm.privateIp ?? ""),
        serviceName: String(edits[row.rowId]?.serviceName ?? row.vm.serviceName ?? ""),
        environment: String(edits[row.rowId]?.environment ?? row.vm.environment ?? ""),
        cpuCores: String(edits[row.rowId]?.cpuCores ?? row.vm.cpuCores ?? ""),
        memoryGb: String(edits[row.rowId]?.memoryGb ?? row.vm.memoryGb ?? ""),
        cluster: String(edits[row.rowId]?.cluster ?? row.vm.cluster ?? ""),
        region: String(edits[row.rowId]?.region ?? row.vm.region ?? ""),
      })),
    [edits, rows],
  );
  const targetRowIds = useMemo(
    () => (batchScope === "all" ? rows.map((row) => row.rowId) : selectedRows),
    [batchScope, rows, selectedRows],
  );
  const batchPreview = useMemo(() => {
    let applyCount = 0;
    let overwriteCount = 0;
    targetRowIds.forEach((rowId) => {
      const row = rows.find((item) => item.rowId === rowId);
      if (!row) {
        return;
      }
      const currentValue = String(edits[rowId]?.[batchField] ?? row.vm[batchField] ?? "").trim();
      const hasValue = !isEmptyForBatchFill(batchField, currentValue);
      const shouldApply = batchStrategy === "overwrite" || !hasValue;
      if (!shouldApply) {
        return;
      }
      applyCount += 1;
      if (hasValue) {
        overwriteCount += 1;
      }
    });
    return { applyCount, overwriteCount };
  }, [batchField, batchStrategy, edits, rows, targetRowIds]);
  const isDirty = useMemo(
    () =>
      JSON.stringify(edits) !== initialEdits ||
      JSON.stringify(ignoredRows) !== initialIgnoredRows,
    [edits, ignoredRows, initialEdits, initialIgnoredRows],
  );

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<OverlayGridRow>) => {
      const selected = event.api
        .getSelectedRows()
        .map((row) => row.rowId)
        .filter((rowId): rowId is number => Number.isFinite(rowId));
      setSelectedRows(selected);
    },
    [],
  );

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev, { edits, ignoredRows }]);
  }, [edits, ignoredRows]);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<OverlayGridRow>) => {
      const rowId = event.data?.rowId;
      const field = event.colDef.field as StandardField | "rowId" | undefined;
      if (rowId === undefined || !field || field === "rowId") {
        return;
      }
      pushHistory();
      setEdits((prev) => ({
        ...prev,
        [rowId]: {
          ...(prev[rowId] ?? {}),
          [field]: String(event.newValue ?? ""),
        },
      }));
    },
    [pushHistory, setEdits],
  );

  const columnDefs = useMemo<ColDef<OverlayGridRow>[]>(
    () => [
      {
        headerName: "rowId",
        field: "rowId",
        width: 96,
        minWidth: 96,
        maxWidth: 108,
        suppressMovable: true,
        checkboxSelection: true,
        headerCheckboxSelection: true,
      },
      ...editableFields.map((field) => ({
        headerName: field,
        field,
        minWidth: 120,
        flex: 1,
        editable: true,
      })),
    ],
    [],
  );

  const applyBatchFill = useCallback(() => {
    if (targetRowIds.length === 0 || !batchValue.trim()) {
      return;
    }
    pushHistory();
    setEdits((prev) => {
      const next = { ...prev };
      targetRowIds.forEach((rowId) => {
        const row = rows.find((item) => item.rowId === rowId);
        if (!row) {
          return;
        }
        const currentValue = String(next[rowId]?.[batchField] ?? row.vm[batchField] ?? "").trim();
        const hasValue = !isEmptyForBatchFill(batchField, currentValue);
        if (batchStrategy === "empty_only" && hasValue) {
          return;
        }
        next[rowId] = {
          ...(next[rowId] ?? {}),
          [batchField]: batchValue,
        };
      });
      return next;
    });
  }, [batchField, batchStrategy, batchValue, pushHistory, rows, setEdits, targetRowIds]);

  const ignoreSelectedRows = useCallback(() => {
    if (selectedRows.length === 0) {
      return;
    }
    pushHistory();
    setIgnoredRows((prev) => Array.from(new Set([...prev, ...selectedRows])));
  }, [pushHistory, selectedRows, setIgnoredRows]);

  const undoLastChange = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const last = prev[prev.length - 1];
      setEdits(last.edits);
      setIgnoredRows(last.ignoredRows);
      return prev.slice(0, -1);
    });
  }, [setEdits, setIgnoredRows]);

  const restoreSnapshot = useCallback(() => {
    const baseEdits = JSON.parse(initialEdits) as typeof edits;
    const baseIgnoredRows = JSON.parse(initialIgnoredRows) as number[];
    setEdits(baseEdits);
    setIgnoredRows(baseIgnoredRows);
    setHistory([]);
  }, [initialEdits, initialIgnoredRows, setEdits, setIgnoredRows]);

  const handleCancel = useCallback(() => {
    if (
      isDirty &&
      !window.confirm("当前有未保存编辑，确认取消并返回校准工作台吗？")
    ) {
      return;
    }
    onCancel();
  }, [isDirty, onCancel]);

  const handleSave = useCallback(() => {
    onSave();
  }, [onSave]);

  return (
    <div className="ai-architecture-generation-dialog__overlay-backdrop">
      <section className="ai-architecture-generation-dialog__overlay">
        <header className="ai-architecture-generation-dialog__overlay-header">
          <h3>批量编辑工具（Table Tools）</h3>
          <p>快速批量修改数据，不会改变校准流程。</p>
        </header>
        <div className="ai-architecture-generation-dialog__table-toolbar">
          <div className="ai-architecture-generation-dialog__toolbar-group">
            <select
              aria-label="批量字段"
              value={batchField}
              onChange={(event) => setBatchField(event.target.value as StandardField)}
            >
              {editableFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <input
              value={batchValue}
              onChange={(event) => setBatchValue(event.target.value)}
              placeholder="批量填充值"
            />
            <select
              aria-label="填充范围"
              value={batchScope}
              onChange={(event) => setBatchScope(event.target.value as "selected" | "all")}
            >
              <option value="selected">仅已勾选行</option>
              <option value="all">全部行</option>
            </select>
            <select
              aria-label="覆盖策略"
              value={batchStrategy}
              onChange={(event) =>
                setBatchStrategy(event.target.value as "empty_only" | "overwrite")
              }
            >
              <option value="empty_only">仅填充空值（安全）</option>
              <option value="overwrite">覆盖已有值（强制）</option>
            </select>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-primary"
              onClick={applyBatchFill}
            >
              批量填充
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-secondary"
              onClick={ignoreSelectedRows}
            >
              忽略所选行
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-ghost"
              onClick={undoLastChange}
              disabled={history.length === 0}
            >
              撤销上一步
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-ghost"
              onClick={restoreSnapshot}
              disabled={!isDirty}
            >
              恢复进入前状态
            </button>
          </div>
          <div className="ai-architecture-generation-dialog__toolbar-meta">
            <span>ignoredRows: {ignoredRows.length}</span>
            <span>{isDirty ? "状态: 已修改" : "状态: 未修改"}</span>
            <span>
              将修改 {batchPreview.applyCount} 行（覆盖已有值 {batchPreview.overwriteCount} 行）
            </span>
          </div>
        </div>
        <div className="ai-architecture-generation-dialog__table-wrap">
          <SharedAgGrid<OverlayGridRow>
            containerClassName="ai-architecture-generation-dialog__ag-grid--overlay"
            rowData={rowData}
            columnDefs={columnDefs}
            getRowId={(params) => String(params.data.rowId)}
            rowSelection={{ mode: "multiRow" }}
            onSelectionChanged={handleSelectionChanged}
            onCellValueChanged={handleCellValueChanged}
            suppressColumnVirtualisation={true}
          />
        </div>
        <footer className="ai-architecture-generation-dialog__actions">
          <button type="button" onClick={handleSave}>
            保存并返回校准工作台
          </button>
          <button type="button" onClick={handleCancel}>
            取消
          </button>
        </footer>
      </section>
    </div>
  );
};
