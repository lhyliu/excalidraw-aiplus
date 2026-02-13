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

export const ImportStep: React.FC<ImportStepProps> = ({
  onContinue,
  onGenerateDraft,
}) => {
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [parsed, setParsed] = useAtom(importedCsvAtom);
  const [onlyKeyColumns, setOnlyKeyColumns] = useState(true);

  const hasData = useMemo(
    () => parsed.headers.length > 0 && parsed.rows.length > 0,
    [parsed.headers.length, parsed.rows.length],
  );
  const previewRows = useMemo(() => parsed.rows.slice(0, 20), [parsed.rows]);
  const previewHeaders = useMemo(() => {
    if (!onlyKeyColumns) {
      return parsed.headers;
    }
    const inferred = inferFieldCandidates(parsed.headers);
    const mapping = buildInitialFieldMapping(inferred);
    const keyFields: StandardField[] = ["hostname", "privateIp", "serviceName"];
    const keyHeaders = keyFields
      .map((field) => mapping[field])
      .filter((header): header is string => Boolean(header));
    if (keyHeaders.length > 0) {
      return keyHeaders;
    }
    return parsed.headers.slice(0, 6);
  }, [onlyKeyColumns, parsed.headers]);
  const previewRowData = useMemo(
    () =>
      previewRows.map((row) => ({
        rowId: row.rowId,
        ...Object.fromEntries(
          previewHeaders.map((header) => [header, row.values[header] ?? ""]),
        ),
      })),
    [previewHeaders, previewRows],
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
      ...previewHeaders.map((header) => ({
        headerName: header,
        field: header,
        minWidth: 150,
        flex: 1,
        suppressMovable: true,
      })),
    ],
    [previewHeaders],
  );
  const handleParse = useCallback(() => {
    let result;
    try {
      result = parseCsv(csvText);
    } catch {
      result = { headers: [], rows: [] };
    }
    if (result.headers.length === 0) {
      setError("CSV 内容为空或格式无效");
      setNotice(null);
      return;
    }
    setParsed(result);
    setError(null);
    setNotice("解析成功，可直接生成初稿，或继续确认字段含义。");
  }, [csvText, setParsed]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      setCsvText(text);
      let result;
      try {
        result = parseCsv(text);
      } catch {
        result = { headers: [], rows: [] };
      }
      setParsed(result);
      setError(result.headers.length === 0 ? "CSV 内容为空或格式无效" : null);
      setNotice(
        result.headers.length === 0
          ? null
          : "文件解析成功，可直接生成初稿，或继续确认字段含义。",
      );
    },
    [setParsed],
  );

  const clearImportedData = useCallback(() => {
    setCsvText("");
    setParsed({ headers: [], rows: [] });
    setError(null);
    setNotice(null);
  }, [setParsed]);

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>CSV 导入</h3>
      <p>上传 CSV 后会直接展示表格预览，先看数据是否正确再继续。</p>
      <textarea
        className="ai-architecture-generation-dialog__textarea"
        rows={8}
        value={csvText}
        onChange={(event) => setCsvText(event.target.value)}
        placeholder="例如: Host Name,IP Address,Service"
      />
      <div className="ai-architecture-generation-dialog__actions">
        <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
        <button type="button" onClick={handleParse}>
          解析 CSV
        </button>
        <button type="button" onClick={clearImportedData} disabled={!hasData && !csvText}>
          清空
        </button>
        <button type="button" onClick={onContinue} disabled={!hasData}>
          进入数据工作台
        </button>
        <button type="button" onClick={onGenerateDraft} disabled={!hasData}>
          一键生成初稿
        </button>
      </div>
      {error && <div className="ai-architecture-generation-dialog__error">{error}</div>}
      {notice && <div className="ai-architecture-generation-dialog__success">{notice}</div>}
      {hasData && (
        <>
          <div className="ai-architecture-generation-dialog__summary">
            已解析 {parsed.rows.length} 行，字段 {parsed.headers.length} 个。当前预览前{" "}
            {previewRows.length} 行。
          </div>
          <div className="ai-architecture-generation-dialog__inline-form">
            <label>
              <input
                type="checkbox"
                checked={onlyKeyColumns}
                onChange={(event) => setOnlyKeyColumns(event.target.checked)}
              />{" "}
              仅看关键列（主机名 / 内网IP / 机器用途）
            </label>
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

