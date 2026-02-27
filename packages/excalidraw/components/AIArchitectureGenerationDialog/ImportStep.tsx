import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ColDef } from "ag-grid-community";

import { useAtom, useSetAtom } from "../../editor-jotai";
import {
  buildInitialFieldMapping,
  importedCsvAtom,
  inferFieldCandidates,
  resetAIArchitectureWorkspaceAtom,
} from "../AIArchitectureGeneration";
import { CsvParser } from "../AIArchitectureGeneration/core/data/CsvParser";
import type { StandardField } from "../AIArchitectureGeneration";

import { SharedAgGrid } from "./SharedAgGrid";

interface ImportStepProps {
  onContinue: () => void;
  onGenerateDraft: () => void;
  readOnly?: boolean;
}

const requiredFields: StandardField[] = ["hostname", "privateIp", "serviceName"];

export const ImportStep: React.FC<ImportStepProps> = ({
  onContinue,
  onGenerateDraft,
  readOnly = false,
}) => {
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useAtom(importedCsvAtom);
  const resetWorkspace = useSetAtom(resetAIArchitectureWorkspaceAtom);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasData = useMemo(
    () => parsed.headers.length > 0 && parsed.rows.length > 0,
    [parsed.headers.length, parsed.rows.length],
  );

  const previewRows = useMemo(() => parsed.rows.slice(0, 20), [parsed.rows]);
  const inferred = useMemo(() => inferFieldCandidates(parsed.headers), [parsed.headers]);
  const suggestedMapping = useMemo(
    () => buildInitialFieldMapping(inferred),
    [inferred],
  );
  const requiredMappedCount = useMemo(
    () => requiredFields.filter((field) => suggestedMapping[field]).length,
    [suggestedMapping],
  );
  const requiredCoverage = useMemo(
    () => Math.round((requiredMappedCount / requiredFields.length) * 100),
    [requiredMappedCount],
  );

  const previewColDefs = useMemo<ColDef<Record<string, string | number>>[]>(
    () => [
      {
        headerName: "#",
        field: "rowId",
        width: 60,
        minWidth: 60,
        maxWidth: 80,
        suppressMovable: true,
        pinned: "left" as const,
      },
      ...parsed.headers.map((header) => ({
        headerName: header,
        field: header,
        minWidth: 120,
        flex: 1,
        suppressMovable: true,
      })),
    ],
    [parsed.headers],
  );
  const previewRowData = useMemo(
    () =>
      previewRows.map((row) => ({
        rowId: row.rowId,
        ...Object.fromEntries(
          parsed.headers.map((header) => [header, row.values[header] ?? ""]),
        ),
      })),
    [parsed.headers, previewRows],
  );

  const ensureValidResult = useCallback(
    (result: typeof parsed): boolean => {
      if (result.headers.length === 0 || result.rows.length === 0) {
        setError("CSV 内容为空或格式无效，请检查后重试");
        setNotice(null);
        return false;
      }
      setParsed(result);
      setError(null);
      return true;
    },
    [setParsed],
  );

  const parseAndContinue = useCallback(
    async (text: string) => {
      if (readOnly) {
        return;
      }
      if (!text.trim()) {
        setError("请输入 CSV 内容");
        setNotice(null);
        return;
      }
      setIsParsing(true);
      setError(null);
      setNotice(null);

      try {
        const result = await CsvParser.parse(text);
        if (!ensureValidResult(result)) {
          return;
        }
        setFileName(null);
        setIsCollapsed(true);
        setNotice("解析完成，可进入字段确认");
        onContinue();
      } catch (e) {
        setError(e instanceof Error ? e.message : "解析失败，请稍后重试");
      } finally {
        setIsParsing(false);
      }
    },
    [ensureValidResult, onContinue, readOnly],
  );

  const handleParseAndContinue = useCallback(() => {
    void parseAndContinue(csvText);
  }, [csvText, parseAndContinue]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) {
        return;
      }
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setIsParsing(true);
      setError(null);
      setNotice(null);

      try {
        const result = await CsvParser.parseFile(file);
        if (!ensureValidResult(result)) {
          return;
        }
        setFileName(file.name);
        setCsvText("");
        setIsCollapsed(true);
        setNotice("文件解析成功，可进入字段确认");
        onContinue();
      } catch (e) {
        setError(e instanceof Error ? e.message : "文件解析失败，请稍后重试");
      } finally {
        setIsParsing(false);
      }
    },
    [ensureValidResult, onContinue, readOnly],
  );

  const handleReimport = useCallback(() => {
    if (readOnly) {
      return;
    }
    setIsCollapsed(false);
  }, [readOnly]);

  const handleClearWorkspace = useCallback(() => {
    if (readOnly) {
      return;
    }
    resetWorkspace();
    setCsvText("");
    setError(null);
    setNotice("已清空当前工作区数据");
    setIsCollapsed(false);
    setFileName(null);
  }, [readOnly, resetWorkspace]);

  return (
    <div className="ai-architecture-generation-dialog__step ai-architecture-generation-dialog__step--import">
      <div className="ai-architecture-generation-dialog__import-header">
        <h3>导入（Ingest）</h3>
        {hasData && (
          <div className="ai-architecture-generation-dialog__import-actions-inline">
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-primary"
              onClick={onContinue}
              disabled={isParsing || readOnly}
            >
              解析并进入字段确认
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-secondary"
              onClick={onGenerateDraft}
              disabled={isParsing || readOnly}
            >
              直接进入草图确认
            </button>
          </div>
        )}
      </div>

      {/* Collapsed summary bar or expanded input area */}
      {isCollapsed && hasData ? (
        <div className="ai-architecture-generation-dialog__import-summary-bar">
          <div className="ai-architecture-generation-dialog__import-summary-info">
            <span className="ai-architecture-generation-dialog__import-summary-icon">📄</span>
            <span className="ai-architecture-generation-dialog__import-summary-name">
              {fileName || "CSV 粘贴数据"}
            </span>
            <span className="ai-architecture-generation-dialog__import-summary-meta">
              {parsed.rows.length} 行 · {parsed.headers.length} 列
            </span>
            <span className="ai-architecture-generation-dialog__import-summary-badge">
              必填命中 {requiredMappedCount}/{requiredFields.length}
            </span>
          </div>
          <button
            type="button"
            className="ai-architecture-generation-dialog__btn-ghost"
            onClick={handleReimport}
            disabled={readOnly}
          >
            重新导入
          </button>
          <button
            type="button"
            className="ai-architecture-generation-dialog__btn-ghost"
            onClick={handleClearWorkspace}
            disabled={readOnly}
          >
            清空当前数据
          </button>
        </div>
      ) : (
        <div className="ai-architecture-generation-dialog__import-input-area">
          <p className="ai-architecture-generation-dialog__summary">
            粘贴或上传 CSV 后，系统将先做质量检查，再进入字段确认。
          </p>
          <textarea
            className="ai-architecture-generation-dialog__textarea"
            rows={5}
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            disabled={readOnly}
            placeholder="例如: Host Name,IP Address,Service"
          />
          <div className="ai-architecture-generation-dialog__import-controls">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="ai-architecture-generation-dialog__file-input-hidden"
            />
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly}
            >
              📁 选择文件
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-primary"
              onClick={handleParseAndContinue}
              disabled={isParsing || readOnly}
            >
              {isParsing ? "解析中..." : "解析并进入字段确认"}
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-secondary"
              onClick={onGenerateDraft}
              disabled={!hasData || isParsing}
            >
              直接进入草图确认
            </button>
          </div>
        </div>
      )}

      {error && <div className="ai-architecture-generation-dialog__error">{error}</div>}
      {notice && !isCollapsed && (
        <div className="ai-architecture-generation-dialog__success">{notice}</div>
      )}

      {/* Data preview section — always visible when data exists */}
      {hasData && (
        <div className="ai-architecture-generation-dialog__import-preview">
          <div className="ai-architecture-generation-dialog__import-preview-header">
            <span className="ai-architecture-generation-dialog__summary">
              预览前 {previewRows.length} 行
            </span>
            <div className="ai-architecture-generation-dialog__import-quality-pills">
              <span className="ai-architecture-generation-dialog__import-pill">
                {parsed.rows.length} 行
              </span>
              <span className="ai-architecture-generation-dialog__import-pill">
                {parsed.headers.length} 列
              </span>
              <span className="ai-architecture-generation-dialog__import-pill ai-architecture-generation-dialog__import-pill--accent">
                命中率 {requiredCoverage}%
              </span>
            </div>
          </div>
          <div className="ai-architecture-generation-dialog__table-wrap ai-architecture-generation-dialog__table-wrap--import">
            <SharedAgGrid<Record<string, string | number>>
              rowData={previewRowData}
              columnDefs={previewColDefs}
              rowHeight={34}
              headerHeight={34}
              domLayout="normal"
            />
          </div>
        </div>
      )}
    </div>
  );
};
