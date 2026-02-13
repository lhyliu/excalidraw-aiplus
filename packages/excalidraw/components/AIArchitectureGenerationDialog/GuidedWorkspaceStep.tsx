import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CellValueChangedEvent,
  ColDef,
  ICellRendererParams,
  IHeaderParams,
} from "ag-grid-community";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  editsAtom,
  ignoredRowsAtom,
  importedCsvAtom,
  issuesAtom,
  normalizedVmRowsAtom,
} from "../AIArchitectureGeneration";
import type { Issue, StandardField } from "../AIArchitectureGeneration";

import { SharedAgGrid } from "./SharedAgGrid";
import { useIssueSuggestion } from "./hooks/useIssueSuggestion";
import { useServiceSemanticSuggestion } from "./hooks/useServiceSemanticSuggestion";

interface GuidedWorkspaceStepProps {
  onContinueDraft: () => void;
  onOpenExpert: () => void;
}

interface GuidedIssueGroup {
  key: string;
  title: string;
  count: number;
  items: Issue[];
  severity: "error" | "warning";
  analysis: string;
  resolvedCount: number;
}

type GuidedGridRow = Record<StandardField, string> & {
  rowId: number;
  ignored: boolean;
};

type ServiceNameHeaderProps = IHeaderParams<GuidedGridRow, string> & {
  onAiFill: () => void;
  busy: boolean;
  disabled: boolean;
};

const editableFields: StandardField[] = [
  "hostname",
  "privateIp",
  "serviceName",
  "environment",
  "cpuCores",
  "memoryGb",
];
const fieldLabelMap: Record<StandardField, string> = {
  hostname: "主机名",
  privateIp: "内网 IP",
  serviceName: "服务名称（组件用途）",
  environment: "部署环境",
  cpuCores: "CPU 核数",
  memoryGb: "内存(GB)",
  cluster: "集群",
  region: "地域",
};
const envSuggestionOptions = [
  { value: "", label: "请选择环境" },
  { value: "production", label: "生产（production）" },
  { value: "staging", label: "预发（staging）" },
  { value: "testing", label: "测试（testing）" },
  { value: "development", label: "开发（development）" },
];

const ServiceNameHeader: React.FC<ServiceNameHeaderProps> = ({
  displayName,
  onAiFill,
  busy,
  disabled,
}) => (
  <div className="ai-architecture-generation-dialog__header-action">
    <span>{displayName}</span>
    <button
      type="button"
      className="ai-architecture-generation-dialog__table-ai-btn"
      aria-label="AI识别服务名称"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAiFill();
      }}
      disabled={disabled}
    >
      {busy ? "识别中..." : "AI识别"}
    </button>
  </div>
);

const getIssueGroupKey = (issue: Issue) => `${issue.code}:${issue.field ?? "_"}`;
const getIssueGroupTitle = (issue: Issue): string => {
  if (issue.code === "missing_required" && issue.field === "hostname") {
    return "主机名缺失";
  }
  if (issue.code === "missing_required" && issue.field === "privateIp") {
    return "内网IP缺失";
  }
  if (issue.code === "missing_required" && issue.field === "serviceName") {
    return "服务名称待补充";
  }
  if (issue.code === "unknown_environment") {
    return "环境标签待确认";
  }
  if (issue.code === "invalid_ip") {
    return "IP 格式异常";
  }
  if (issue.code === "duplicate_hostname") {
    return "主机名重复";
  }
  if (issue.code === "duplicate_ip") {
    return "IP 冲突";
  }
  return "其他待确认项";
};

const getIssueGroupAnalysis = (issue: Issue, count: number) => {
  if (issue.code === "unknown_environment") {
    return `检测到 ${count} 台资产环境值不标准，建议先批量设为 production。`;
  }
  if (issue.code === "missing_required" && issue.field === "serviceName") {
    return `检测到 ${count} 台资产缺少服务名称。建议先按组件用途补齐。`;
  }
  if (issue.code === "invalid_ip") {
    return `检测到 ${count} 条 IP 格式异常，会影响网络拓扑判断。`;
  }
  return `检测到 ${count} 条待确认信息，可批量处理。`;
};

const isEnvironmentGroup = (group: GuidedIssueGroup) =>
  group.items.length > 0 &&
  group.items.every(
    (issue) => issue.code === "unknown_environment" && issue.field === "environment",
  );

export const GuidedWorkspaceStep: React.FC<GuidedWorkspaceStepProps> = ({
  onContinueDraft,
  onOpenExpert,
}) => {
  const importedCsv = useAtomValue(importedCsvAtom);
  const rows = useAtomValue(normalizedVmRowsAtom);
  const issues = useAtomValue(issuesAtom);
  const [edits, setEdits] = useAtom(editsAtom);
  const [ignoredRows, setIgnoredRows] = useAtom(ignoredRowsAtom);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeIssueGroupKey, setActiveIssueGroupKey] = useState<string | null>(null);
  const [groupDraftValues, setGroupDraftValues] = useState<Record<string, string>>({});
  const [aiSuggestionNote, setAiSuggestionNote] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [semanticReasonPreview, setSemanticReasonPreview] = useState<string | null>(
    null,
  );
  const [semanticLoadingType, setSemanticLoadingType] = useState<"bulk" | "single" | null>(
    null,
  );
  const [singleLoadingRowId, setSingleLoadingRowId] = useState<number | null>(null);
  const [aiUpdatedCells, setAiUpdatedCells] = useState<Record<string, true>>({});
  const aiUpdatedCellTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tablePageSize = 40;
  const { requestSuggestion: requestIssueSuggestion, isStreaming: isIssueAISuggesting } =
    useIssueSuggestion();
  const { inferMissingServiceNames, isStreaming: isSemanticInferring } =
    useServiceSemanticSuggestion();
  const semanticBusy = isSemanticInferring || semanticLoadingType !== null;

  const markAiUpdatedCells = useCallback((cells: Array<{ rowId: number; field: StandardField }>) => {
    if (cells.length === 0) {
      return;
    }
    setAiUpdatedCells((prev) => {
      const next = { ...prev };
      cells.forEach((cell) => {
        const key = `${cell.rowId}:${cell.field}`;
        next[key] = true;
      });
      return next;
    });
    cells.forEach((cell) => {
      const key = `${cell.rowId}:${cell.field}`;
      if (aiUpdatedCellTimers.current[key]) {
        clearTimeout(aiUpdatedCellTimers.current[key]);
      }
      aiUpdatedCellTimers.current[key] = setTimeout(() => {
        setAiUpdatedCells((prev) => {
          if (!prev[key]) {
            return prev;
          }
          const next = { ...prev };
          delete next[key];
          return next;
        });
        delete aiUpdatedCellTimers.current[key];
      }, 2500);
    });
  }, []);

  useEffect(() => {
    return () => {
      Object.values(aiUpdatedCellTimers.current).forEach((timer) => clearTimeout(timer));
      aiUpdatedCellTimers.current = {};
    };
  }, []);

  const groupedIssues = useMemo(() => {
    const map = new Map<string, GuidedIssueGroup>();
    issues.forEach((issue) => {
      const key = getIssueGroupKey(issue);
      const current = map.get(key);
      const resolved =
        !!issue.field &&
        (edits[issue.rowId]?.[issue.field] ?? "").toString().trim().length > 0;
      if (!current) {
        map.set(key, {
          key,
          title: getIssueGroupTitle(issue),
          count: 1,
          items: [issue],
          severity: issue.severity,
          analysis: getIssueGroupAnalysis(issue, 1),
          resolvedCount: resolved ? 1 : 0,
        });
        return;
      }
      current.count += 1;
      current.items.push(issue);
      if (issue.severity === "error") {
        current.severity = "error";
      }
      if (resolved) {
        current.resolvedCount += 1;
      }
      current.analysis = getIssueGroupAnalysis(issue, current.count);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [edits, issues]);

  const activeIssueGroup =
    groupedIssues.find((group) => group.key === activeIssueGroupKey) ?? groupedIssues[0];
  const issueFieldKeySet = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((issue) => {
      if (issue.field) {
        set.add(`${issue.rowId}:${issue.field}`);
      }
    });
    return set;
  }, [issues]);
  const rowContextById = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc[row.rowId] = {
            hostname: row.vm.hostname,
            privateIp: row.vm.privateIp,
            serviceName: row.vm.serviceName,
          };
          return acc;
        },
        {} as Record<
          number,
          {
            hostname: string;
            privateIp: string;
            serviceName: string;
          }
        >,
      ),
    [rows],
  );
  const tableTotalPages = Math.max(1, Math.ceil(rows.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, tableTotalPages);
  const tableRows = useMemo(() => {
    const start = (safeTablePage - 1) * tablePageSize;
    return rows.slice(start, start + tablePageSize);
  }, [rows, safeTablePage]);
  const tableRowData = useMemo<GuidedGridRow[]>(
    () =>
      tableRows.map((row) => ({
        rowId: row.rowId,
        ignored: ignoredRows.includes(row.rowId),
        hostname: String(edits[row.rowId]?.hostname ?? row.vm.hostname ?? ""),
        privateIp: String(edits[row.rowId]?.privateIp ?? row.vm.privateIp ?? ""),
        serviceName: String(edits[row.rowId]?.serviceName ?? row.vm.serviceName ?? ""),
        environment: String(edits[row.rowId]?.environment ?? row.vm.environment ?? ""),
        cpuCores: String(edits[row.rowId]?.cpuCores ?? row.vm.cpuCores ?? ""),
        memoryGb: String(edits[row.rowId]?.memoryGb ?? row.vm.memoryGb ?? ""),
        cluster: String(edits[row.rowId]?.cluster ?? row.vm.cluster ?? ""),
        region: String(edits[row.rowId]?.region ?? row.vm.region ?? ""),
      })),
    [edits, ignoredRows, tableRows],
  );
  const missingServiceRows = useMemo(
    () =>
      rows.filter((row) => {
        const edited = String(edits[row.rowId]?.serviceName ?? "").trim();
        const current = String(row.vm.serviceName ?? "").trim();
        if (edited.length > 0) {
          return false;
        }
        return current.length === 0 || current === "unknown";
      }),
    [edits, rows],
  );
  const blockingErrorCount = useMemo(
    () =>
      issues.filter((issue) => {
        if (issue.severity !== "error") {
          return false;
        }
        if (!issue.field) {
          return true;
        }
        return (edits[issue.rowId]?.[issue.field] ?? "").toString().trim().length === 0;
      }).length,
    [edits, issues],
  );
  const canContinueDraft = importedCsv.rows.length > 0 && blockingErrorCount === 0;

  const handleGridCellValueChanged = useCallback(
    (event: CellValueChangedEvent<GuidedGridRow>) => {
      const rowId = event.data?.rowId;
      const field = event.colDef.field as StandardField | "ignored" | "rowId" | undefined;
      if (rowId === undefined || !field || field === "rowId") {
        return;
      }
      if (field === "ignored") {
        const nextIgnored = Boolean(event.newValue);
        setIgnoredRows((prev) => {
          const has = prev.includes(rowId);
          if (nextIgnored && !has) {
            return [...prev, rowId];
          }
          if (!nextIgnored && has) {
            return prev.filter((id) => id !== rowId);
          }
          return prev;
        });
        return;
      }
      setEdits((prev) => ({
        ...prev,
        [rowId]: {
          ...(prev[rowId] ?? {}),
          [field]: String(event.newValue ?? ""),
        },
      }));
    },
    [setEdits, setIgnoredRows],
  );

  const applyIssueGroupFix = useCallback(
    (group: GuidedIssueGroup) => {
      const draft = (groupDraftValues[group.key] ?? "").trim();
      const target = group.items
        .filter((issue) => issue.field)
        .map((issue) => ({
          rowId: issue.rowId,
          field: issue.field as StandardField,
          value: draft || (issue.suggestedValue ?? ""),
        }))
        .filter((item) => item.value.trim().length > 0);
      if (target.length === 0) {
        setNotice("该分组暂无可直接应用的建议值，可点击 AI 生成建议。");
        return;
      }
      setEdits((prev) => {
        const next = { ...prev };
        target.forEach((item) => {
          next[item.rowId] = {
            ...(next[item.rowId] ?? {}),
            [item.field]: item.value,
          };
        });
        return next;
      });
      setNotice(`已应用「${group.title}」共 ${target.length} 项。`);
    },
    [groupDraftValues, setEdits],
  );

  const fillMissingServiceNamesByAI = useCallback(async () => {
    setSemanticReasonPreview(null);
    if (missingServiceRows.length === 0) {
      setNotice("当前没有需要 AI 识别的空机器用途行。");
      return;
    }
    setSemanticLoadingType("bulk");
    setSingleLoadingRowId(null);
    try {
      const suggestions = await inferMissingServiceNames(
        missingServiceRows.slice(0, 80).map((row) => ({
          rowId: row.rowId,
          hostname: row.vm.hostname,
          privateIp: row.vm.privateIp,
          environment: row.vm.environment,
          cpuCores: row.vm.cpuCores,
          memoryGb: row.vm.memoryGb,
          raw: row.raw,
        })),
      );
      if (suggestions.length === 0) {
        setNotice("AI 暂未给出可靠机器用途建议，请手动补录。");
        return;
      }
      let appliedCount = 0;
      const appliedCells: Array<{ rowId: number; field: StandardField }> = [];
      setEdits((prev) => {
        const next = { ...prev };
        suggestions.forEach((item) => {
          if (!rows.some((row) => row.rowId === item.rowId)) {
            return;
          }
          if (!item.serviceName || item.serviceName === "unknown") {
            return;
          }
          next[item.rowId] = {
            ...(next[item.rowId] ?? {}),
            serviceName: item.serviceName,
          };
          appliedCount += 1;
          appliedCells.push({ rowId: item.rowId, field: "serviceName" });
        });
        return next;
      });
      markAiUpdatedCells(appliedCells);
      const firstReason = suggestions.find((item) => item.reason)?.reason;
      if (firstReason) {
        setSemanticReasonPreview(firstReason);
      }
      setNotice(`已应用 AI 机器用途识别 ${appliedCount} 条。`);
    } finally {
      setSemanticLoadingType(null);
    }
  }, [inferMissingServiceNames, markAiUpdatedCells, missingServiceRows, rows, setEdits]);

  const fillSingleServiceNameByAI = useCallback(
    async (rowId: number) => {
      const row = rows.find((item) => item.rowId === rowId);
      if (!row) {
        return;
      }
      setSemanticReasonPreview(null);
      setSemanticLoadingType("single");
      setSingleLoadingRowId(rowId);
      try {
        const suggestions = await inferMissingServiceNames([
          {
            rowId: row.rowId,
            hostname: row.vm.hostname,
            privateIp: row.vm.privateIp,
            environment: row.vm.environment,
            cpuCores: row.vm.cpuCores,
            memoryGb: row.vm.memoryGb,
            raw: row.raw,
          },
        ]);
        const suggestion = suggestions.find(
          (item) => item.rowId === rowId && item.serviceName && item.serviceName !== "unknown",
        );
        if (!suggestion) {
          setNotice(`Row ${rowId} 暂无可靠 AI 建议，请手动填写。`);
          return;
        }
        setEdits((prev) => ({
          ...prev,
          [rowId]: {
            ...(prev[rowId] ?? {}),
            serviceName: suggestion.serviceName,
          },
        }));
        markAiUpdatedCells([{ rowId, field: "serviceName" }]);
        if (suggestion.reason) {
          setSemanticReasonPreview(suggestion.reason);
        }
        setNotice(`已应用 AI 单条识别: Row ${rowId} -> ${suggestion.serviceName}`);
      } finally {
        setSemanticLoadingType(null);
        setSingleLoadingRowId(null);
      }
    },
    [inferMissingServiceNames, markAiUpdatedCells, rows, setEdits],
  );

  const tableColDefs = useMemo<ColDef<GuidedGridRow>[]>(
    () => [
      {
        headerName: "忽略",
        field: "ignored",
        width: 72,
        minWidth: 72,
        maxWidth: 72,
        suppressMovable: true,
        sortable: false,
        editable: true,
        cellDataType: "boolean",
        cellRenderer: "agCheckboxCellRenderer",
        cellEditor: "agCheckboxCellEditor",
      },
      {
        headerName: "rowId",
        field: "rowId",
        width: 84,
        minWidth: 84,
        maxWidth: 84,
        suppressMovable: true,
      },
      ...editableFields.map((field) => ({
        headerName: fieldLabelMap[field],
        field,
        minWidth: field === "serviceName" ? 220 : 160,
        flex: 1,
        suppressMovable: true,
        editable: true,
        ...(field === "serviceName"
          ? {
              headerComponent: "serviceNameHeader",
              headerComponentParams: {
                onAiFill: fillMissingServiceNamesByAI,
                busy: semanticBusy,
                disabled: semanticBusy || missingServiceRows.length === 0,
              },
            }
          : {}),
        cellClass: (params: ICellRendererParams<GuidedGridRow, string>) => {
          const rowId = params.data?.rowId;
          if (rowId === undefined) {
            return undefined;
          }
          const classes: string[] = [];
          if (issueFieldKeySet.has(`${rowId}:${field}`)) {
            classes.push("ai-architecture-generation-dialog__cell-has-issue");
          }
          if (aiUpdatedCells[`${rowId}:${field}`]) {
            classes.push("ai-architecture-generation-dialog__cell-ai-updated");
          }
          return classes.length > 0 ? classes.join(" ") : undefined;
        },
      })),
    ],
    [
      aiUpdatedCells,
      fillMissingServiceNamesByAI,
      issueFieldKeySet,
      missingServiceRows.length,
      semanticBusy,
    ],
  );

  const requestIssueGroupAISuggestion = useCallback(
    async (group: GuidedIssueGroup) => {
      setAiSuggestionNote(null);
      const suggestion = await requestIssueSuggestion(
        group.title,
        group.items[0]?.code ?? "missing_required",
        group.items[0]?.field,
        group.items.slice(0, 8).map((issue) => ({
          rowId: issue.rowId,
          hostname: rowContextById[issue.rowId]?.hostname ?? "",
          privateIp: rowContextById[issue.rowId]?.privateIp ?? "",
          serviceName: rowContextById[issue.rowId]?.serviceName ?? "",
          message: issue.message,
        })),
      );
      if (!suggestion) {
        setNotice("AI 暂未给出可靠建议，请手动填写。");
        return;
      }
      setGroupDraftValues((prev) => ({
        ...prev,
        [group.key]: suggestion.suggestedValue,
      }));
      setAiSuggestionNote(suggestion.reason || "基于样本资产推断");
      setNotice(`AI 建议值：${suggestion.suggestedValue}`);
    },
    [requestIssueSuggestion, rowContextById],
  );

  if (importedCsv.headers.length === 0) {
    return (
      <div className="ai-architecture-generation-dialog__step">
        <h3>问题修复工作台</h3>
        <p>请先导入 CSV 并完成字段确认。</p>
      </div>
    );
  }

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>问题修复工作台</h3>
      <p>待修复问题按类型聚合展示。error 清零后才可进入草图生成。</p>
      {notice && <div className="ai-architecture-generation-dialog__success">{notice}</div>}

      <div className="ai-architecture-generation-dialog__workspace">
        <section className="ai-architecture-generation-dialog__workspace-table">
          <div className="ai-architecture-generation-dialog__table-toolbar">
            <div className="ai-architecture-generation-dialog__toolbar-group">
              <strong>资产明细表（实时）</strong>
              <span className="ai-architecture-generation-dialog__summary">
                共 {rows.length} 台
              </span>
            </div>
            <div className="ai-architecture-generation-dialog__toolbar-group">
              <button
                type="button"
                className="ai-architecture-generation-dialog__btn-primary"
                onClick={onOpenExpert}
              >
                打开批量编辑工具
              </button>
            </div>
          </div>
          {semanticReasonPreview && (
            <div className="ai-architecture-generation-dialog__summary">
              AI 识别依据示例: {semanticReasonPreview}
            </div>
          )}
          <button
            type="button"
            className="ai-architecture-generation-dialog__table-ai-fallback"
            aria-label="AI识别服务名称"
            onClick={fillMissingServiceNamesByAI}
            disabled={semanticBusy || missingServiceRows.length === 0}
          >
            AI识别服务名称
          </button>
          {missingServiceRows.length > 0 && (
            <div className="ai-architecture-generation-dialog__inline-form">
              <span className="ai-architecture-generation-dialog__summary">空服务名快速识别：</span>
              {missingServiceRows.slice(0, 8).map((row) => (
                <button
                  key={`quick-ai-${row.rowId}`}
                  type="button"
                  className="ai-architecture-generation-dialog__cell-ai-btn"
                  aria-label={`AI识别服务名称 row ${row.rowId}`}
                  onClick={() => fillSingleServiceNameByAI(row.rowId)}
                  disabled={semanticBusy}
                >
                  {semanticLoadingType === "single" && singleLoadingRowId === row.rowId
                    ? `Row ${row.rowId} 识别中...`
                    : `Row ${row.rowId} AI识别`}
                </button>
              ))}
            </div>
          )}
          <div className="ai-architecture-generation-dialog__table-wrap">
            <SharedAgGrid<GuidedGridRow>
              rowData={tableRowData}
              columnDefs={tableColDefs}
              components={{ serviceNameHeader: ServiceNameHeader }}
              getRowId={(params) => String(params.data.rowId)}
              onCellValueChanged={handleGridCellValueChanged}
            />
          </div>
          <div className="ai-architecture-generation-dialog__inline-form">
            <button
              type="button"
              onClick={() => setTablePage((prev) => Math.max(1, prev - 1))}
              disabled={safeTablePage <= 1}
            >
              上一页
            </button>
            <span className="ai-architecture-generation-dialog__summary">
              第 {safeTablePage}/{tableTotalPages} 页
            </span>
            <button
              type="button"
              onClick={() =>
                setTablePage((prev) => Math.min(tableTotalPages, prev + 1))
              }
              disabled={safeTablePage >= tableTotalPages}
            >
              下一页
            </button>
          </div>
        </section>

        <aside className="ai-architecture-generation-dialog__workspace-guide">
          <h4>问题分组修复</h4>
          <div className="ai-architecture-generation-dialog__summary">
            待处理问题类型: {groupedIssues.length}
          </div>
          <div className="ai-architecture-generation-dialog__summary">
            阻断问题（error）剩余: {blockingErrorCount}
          </div>
          <div className="ai-architecture-generation-dialog__inline-form">
            {groupedIssues.map((group) => (
              <button
                key={group.key}
                type="button"
                className={`ai-architecture-generation-dialog__issue-type-card${
                  activeIssueGroup?.key === group.key ? " is-active" : ""
                }`}
                onClick={() => setActiveIssueGroupKey(group.key)}
              >
                {group.title} ({group.count})
              </button>
            ))}
          </div>
          {!activeIssueGroup && (
            <div className="ai-architecture-generation-dialog__summary">
              当前无待确认问题。
            </div>
          )}
          {activeIssueGroup && (
            <div className="ai-architecture-generation-dialog__issue-card">
              <strong>{activeIssueGroup.title}</strong>
              <div className="ai-architecture-generation-dialog__summary">
                {activeIssueGroup.analysis}
              </div>
              <div className="ai-architecture-generation-dialog__summary">
                已处理 {activeIssueGroup.resolvedCount}/{activeIssueGroup.count}
              </div>
              <div className="ai-architecture-generation-dialog__inline-form">
                {isEnvironmentGroup(activeIssueGroup) ? (
                  <select
                    aria-label="待确认值"
                    value={groupDraftValues[activeIssueGroup.key] ?? ""}
                    onChange={(event) =>
                      setGroupDraftValues((prev) => ({
                        ...prev,
                        [activeIssueGroup.key]: event.target.value,
                      }))
                    }
                  >
                    {envSuggestionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label="待确认值"
                    value={groupDraftValues[activeIssueGroup.key] ?? ""}
                    onChange={(event) =>
                      setGroupDraftValues((prev) => ({
                        ...prev,
                        [activeIssueGroup.key]: event.target.value,
                      }))
                    }
                    placeholder="输入建议值"
                  />
                )}
                <button type="button" onClick={() => applyIssueGroupFix(activeIssueGroup)}>
                  应用到该类问题
                </button>
                <button
                  type="button"
                  onClick={() => requestIssueGroupAISuggestion(activeIssueGroup)}
                  disabled={isIssueAISuggesting}
                >
                  {isIssueAISuggesting ? "AI 建议生成中..." : "AI 生成建议"}
                </button>
              </div>
              {aiSuggestionNote && (
                <div className="ai-architecture-generation-dialog__summary">
                  AI 建议说明: {aiSuggestionNote}
                </div>
              )}
              <div className="ai-architecture-generation-dialog__summary">预览样本:</div>
              <div className="ai-architecture-generation-dialog__insight-evidence">
                {activeIssueGroup.items.slice(0, 4).map((issue) => (
                  <div key={issue.id}>
                    Row {issue.rowId} | {rowContextById[issue.rowId]?.hostname || "-"} |{" "}
                    {rowContextById[issue.rowId]?.privateIp || "-"} | {issue.message}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={onContinueDraft} disabled={!canContinueDraft}>
            进入草图生成
          </button>
        </aside>
      </div>
    </div>
  );
};

