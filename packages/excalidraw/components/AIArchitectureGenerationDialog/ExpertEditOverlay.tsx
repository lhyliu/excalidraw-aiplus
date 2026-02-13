import React, { useCallback, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  editsAtom,
  ignoredRowsAtom,
  normalizedVmRowsAtom,
} from "../AIArchitectureGeneration";
import type { StandardField } from "../AIArchitectureGeneration";

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
  const [history, setHistory] = useState<Array<{ edits: typeof edits; ignoredRows: number[] }>>(
    [],
  );

  const selectedSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const isDirty = useMemo(
    () =>
      JSON.stringify(edits) !== initialEdits ||
      JSON.stringify(ignoredRows) !== initialIgnoredRows,
    [edits, ignoredRows, initialEdits, initialIgnoredRows],
  );

  const toggleSelect = useCallback((rowId: number) => {
    setSelectedRows((prev) =>
      prev.includes(rowId) ? prev.filter((value) => value !== rowId) : [...prev, rowId],
    );
  }, []);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev, { edits, ignoredRows }]);
  }, [edits, ignoredRows]);

  const updateCell = useCallback(
    (rowId: number, field: StandardField, value: string) => {
      pushHistory();
      setEdits((prev) => ({
        ...prev,
        [rowId]: {
          ...(prev[rowId] ?? {}),
          [field]: value,
        },
      }));
    },
    [pushHistory, setEdits],
  );

  const applyBatchFill = useCallback(() => {
    if (selectedRows.length === 0 || !batchValue.trim()) {
      return;
    }
    pushHistory();
    setEdits((prev) => {
      const next = { ...prev };
      selectedRows.forEach((rowId) => {
        next[rowId] = {
          ...(next[rowId] ?? {}),
          [batchField]: batchValue,
        };
      });
      return next;
    });
  }, [batchField, batchValue, pushHistory, selectedRows, setEdits]);

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
      !window.confirm("当前有未保存编辑，确认取消并返回 AI 校准吗？")
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
          <h3>专家模式（Advanced Editing）</h3>
          <p>快速批量修改数据，不会改变 AI 校准流程。</p>
        </header>
        <div className="ai-architecture-generation-dialog__inline-form">
          <select
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
          <button type="button" onClick={applyBatchFill}>
            批量填充
          </button>
          <button type="button" onClick={ignoreSelectedRows}>
            忽略所选行
          </button>
          <button type="button" onClick={undoLastChange} disabled={history.length === 0}>
            撤销上一步
          </button>
          <button type="button" onClick={restoreSnapshot} disabled={!isDirty}>
            恢复进入前状态
          </button>
          <span>ignoredRows: {ignoredRows.length}</span>
          <span>{isDirty ? "状态: 已修改" : "状态: 未修改"}</span>
        </div>
        <div className="ai-architecture-generation-dialog__table-wrap">
          <table className="ai-architecture-generation-dialog__table">
            <thead>
              <tr>
                <th>选中</th>
                <th>rowId</th>
                {editableFields.map((field) => (
                  <th key={field}>{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row.rowId)}
                      onChange={() => toggleSelect(row.rowId)}
                    />
                  </td>
                  <td>{row.rowId}</td>
                  {editableFields.map((field) => (
                    <td key={`${row.rowId}:${field}`}>
                      <input
                        value={edits[row.rowId]?.[field] ?? String(row.vm[field] ?? "")}
                        onChange={(event) =>
                          updateCell(row.rowId, field, event.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="ai-architecture-generation-dialog__actions">
          <button type="button" onClick={handleSave}>
            保存并返回 AI 校准
          </button>
          <button type="button" onClick={handleCancel}>
            取消
          </button>
        </footer>
      </section>
    </div>
  );
};

