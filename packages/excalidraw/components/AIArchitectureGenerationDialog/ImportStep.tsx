import React, { useCallback, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";

import { useAtom } from "../../editor-jotai";
import {
  buildInitialFieldMapping,
  importedCsvAtom,
  inferFieldCandidates,
  parseCsv,
} from "../AIArchitectureGeneration";
import type { StandardField } from "../AIArchitectureGeneration";

import { SharedAgGrid } from "./SharedAgGrid";

interface ImportStepProps {
  onContinue: () => void;
  onGenerateDraft: () => void;
}

const requiredFields: StandardField[] = ["hostname", "privateIp", "serviceName"];

export const ImportStep: React.FC<ImportStepProps> = ({
  onContinue,
  onGenerateDraft,
}) => {
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [parsed, setParsed] = useAtom(importedCsvAtom);

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
        headerName: "rowId",
        field: "rowId",
        width: 90,
        minWidth: 90,
        maxWidth: 110,
        suppressMovable: true,
      },
      ...parsed.headers.map((header) => ({
        headerName: header,
        field: header,
        minWidth: 150,
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

  const parseAndContinue = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setError("请输入 CSV 内容");
        setNotice(null);
        return;
      }
      let result;
      try {
        result = parseCsv(text);
      } catch {
        result = { headers: [], rows: [] };
      }
      if (result.headers.length === 0 || result.rows.length === 0) {
        setError("CSV 内容为空或格式无效");
        setNotice(null);
        return;
      }
      setParsed(result);
      setError(null);
      setNotice("已完成解析。可进入字段确认继续校验。");
      onContinue();
    },
    [onContinue, setParsed],
  );

  const handleParseAndContinue = useCallback(() => {
    parseAndContinue(csvText);
  }, [csvText, parseAndContinue]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      setCsvText(text);
      parseAndContinue(text);
    },
    [parseAndContinue],
  );

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>导入（Ingest）</h3>
      <p>粘贴或上传 CSV 后，系统会先完成质量检查并进入字段确认。</p>
      <textarea
        className="ai-architecture-generation-dialog__textarea"
        rows={8}
        value={csvText}
        onChange={(event) => setCsvText(event.target.value)}
        placeholder="例如: Host Name,IP Address,Service"
      />
      <div className="ai-architecture-generation-dialog__actions">
        <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
        <button type="button" onClick={handleParseAndContinue}>
          解析并进入字段确认
        </button>
        <button type="button" onClick={onGenerateDraft} disabled={!hasData}>
          直接进入草图确认
        </button>
      </div>
      {error && <div className="ai-architecture-generation-dialog__error">{error}</div>}
      {notice && <div className="ai-architecture-generation-dialog__success">{notice}</div>}
      {hasData && (
        <>
          <div className="ai-architecture-generation-dialog__issue-card">
            <strong>数据质量卡</strong>
            <div className="ai-architecture-generation-dialog__summary">
              行数: {parsed.rows.length} | 字段数: {parsed.headers.length}
            </div>
            <div className="ai-architecture-generation-dialog__summary">
              必填字段命中率: {requiredMappedCount}/{requiredFields.length} ({requiredCoverage}%)
            </div>
          </div>
          <div className="ai-architecture-generation-dialog__summary">
            预览前 {previewRows.length} 行
          </div>
          <div className="ai-architecture-generation-dialog__table-wrap">
            <SharedAgGrid<Record<string, string | number>>
              rowData={previewRowData}
              columnDefs={previewColDefs}
              rowHeight={36}
              headerHeight={36}
            />
          </div>
        </>
      )}
    </div>
  );
};

