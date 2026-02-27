import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CellClassParams,
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
import { getAIStreamStallTimeoutMs } from "../../services/aiService";

import { SharedAgGrid } from "./SharedAgGrid";
import { useServiceSemanticSuggestion } from "./hooks/useServiceSemanticSuggestion";

interface GuidedWorkspaceStepProps {
  onContinueDraft: () => void;
  activeIssueFilterKey: string | null;
  onActiveIssueFilterKeyChange: (issueFilter: string | null) => void;
  readOnly?: boolean;
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

type ServiceNameCellRendererProps = ICellRendererParams<GuidedGridRow, string> & {
  onAiFillSingle: (rowId: number) => void;
  aiBusy: boolean;
  singleLoadingRowId: number | null;
  readOnly: boolean;
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
  region: "区域",
};

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
      className="ai-architecture-generation-dialog__icon-btn"
      aria-label="AI 补全本列空白"
      title="AI 补全本列空白"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAiFill();
      }}
      disabled={disabled}
    >
      {busy ? "..." : "AI"}
    </button>
  </div>
);

const ServiceNameCellRenderer: React.FC<ServiceNameCellRendererProps> = ({
  value,
  data,
  onAiFillSingle,
  aiBusy,
  singleLoadingRowId,
  readOnly,
}) => {
  if (!data) {
    return null;
  }
  const text = String(value ?? "").trim();
  const isEmpty = text.length === 0 || text === "unknown";
  if (!isEmpty) {
    return <span>{text}</span>;
  }
  const loading = aiBusy && singleLoadingRowId === data.rowId;
  return (
    <button
      type="button"
      className="ai-architecture-generation-dialog__cell-ai-icon-btn"
      aria-label={`AI 补全该项 row ${data.rowId}`}
      title="AI 补全该项"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAiFillSingle(data.rowId);
      }}
      disabled={aiBusy || readOnly}
    >
      {loading ? "..." : "AI"}
    </button>
  );
};

const AI_SINGLE_RETRY_TIMES = 1;
const AI_BULK_CHUNK_SIZE = 16;
const AI_BULK_CHUNK_RETRY_TIMES = 1;

const getIssueGroupKey = (issue: Issue) => `${issue.code}:${issue.field ?? "_"}`;

const getIssueGroupTitle = (issue: Issue): string => {
  if (issue.code === "missing_required" && issue.field === "hostname") {
    return "主机名缺失";
  }
  if (issue.code === "missing_required" && issue.field === "privateIp") {
    return "内网IP缺失";
  }
  if (issue.code === "missing_required" && issue.field === "serviceName") {
    return "服务名称待补全";
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
    return `检测到 ${count} 台资产环境值不标准，建议先批量统一。`;
  }
  if (issue.code === "missing_required" && issue.field === "serviceName") {
    return `检测到 ${count} 台资产缺少服务名称，建议优先补全。`;
  }
  if (issue.code === "invalid_ip") {
    return `检测到 ${count} 条 IP 格式异常，可能影响拓扑推断。`;
  }
  return `检测到 ${count} 条待确认信息，可批量处理。`;
};

export const GuidedWorkspaceStep: React.FC<GuidedWorkspaceStepProps> = ({
  onContinueDraft,
  activeIssueFilterKey,
  onActiveIssueFilterKeyChange,
  readOnly = false,
}) => {
  const importedCsv = useAtomValue(importedCsvAtom);
  const rows = useAtomValue(normalizedVmRowsAtom);
  const issues = useAtomValue(issuesAtom);
  const [edits, setEdits] = useAtom(editsAtom);
  const [ignoredRows, setIgnoredRows] = useAtom(ignoredRowsAtom);

  const [notice, setNotice] = useState<string | null>(null);
  const [isFullscreenEditing, setIsFullscreenEditing] = useState(false);
  const [showFullscreenHint, setShowFullscreenHint] = useState(false);
  const [hasDismissedFullscreenHint, setHasDismissedFullscreenHint] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [semanticReasonPreview, setSemanticReasonPreview] = useState<string | null>(null);
  const [semanticLoadingType, setSemanticLoadingType] = useState<"bulk" | "single" | null>(null);
  const [singleLoadingRowId, setSingleLoadingRowId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [aiUpdatedCells, setAiUpdatedCells] = useState<Record<string, true>>({});

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const aiUpdatedCellTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const aiRequestSeqRef = useRef(0);
  const bulkCancelRequestedRef = useRef(false);
  const tablePageSize = 40;

  const {
    inferMissingServiceNames,
    abortSemanticInference,
    isStreaming: isSemanticInferring,
  } =
    useServiceSemanticSuggestion();
  const semanticBusy = isSemanticInferring || semanticLoadingType !== null;

  const markAiUpdatedCells = useCallback((cells: Array<{ rowId: number; field: StandardField }>) => {
    if (cells.length === 0) {
      return;
    }
    setAiUpdatedCells((prev) => {
      const next = { ...prev };
      cells.forEach((cell) => {
        next[`${cell.rowId}:${cell.field}`] = true;
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

  const deferredEdits = React.useDeferredValue(edits);

  const groupedIssues = useMemo(() => {
    const map = new Map<string, GuidedIssueGroup>();
    issues.forEach((issue) => {
      const key = getIssueGroupKey(issue);
      const current = map.get(key);
      const resolved =
        !!issue.field &&
        (deferredEdits[issue.rowId]?.[issue.field] ?? "").toString().trim().length > 0;

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
  }, [deferredEdits, issues]);

  const activeIssueGroup = groupedIssues.find((group) => group.key === activeIssueFilterKey);

  const issueRowsByGroupKey = useMemo(() => {
    const map = new Map<string, Set<number>>();
    groupedIssues.forEach((group) => {
      map.set(group.key, new Set(group.items.map((item) => item.rowId)));
    });
    return map;
  }, [groupedIssues]);
  const issueFieldKeySet = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((issue) => {
      if (issue.field) {
        set.add(`${issue.rowId}:${issue.field}`);
      }
    });
    return set;
  }, [issues]);

  const filteredRows = useMemo(() => {
    let nextRows = rows;
    if (activeIssueFilterKey) {
      const filteredRowSet = issueRowsByGroupKey.get(activeIssueFilterKey);
      nextRows = nextRows.filter((row) => filteredRowSet?.has(row.rowId));
    }
    return nextRows;
  }, [activeIssueFilterKey, issueRowsByGroupKey, rows]);

  const tableTotalPages = Math.max(1, Math.ceil(filteredRows.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, tableTotalPages);
  const tableRows = useMemo(() => {
    const start = (safeTablePage - 1) * tablePageSize;
    return filteredRows.slice(start, start + tablePageSize);
  }, [filteredRows, safeTablePage]);

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
  const unresolvedIssueCount = useMemo(
    () =>
      issues.filter((issue) => {
        if (!issue.field) {
          return true;
        }
        return (edits[issue.rowId]?.[issue.field] ?? "").toString().trim().length === 0;
      }).length,
    [edits, issues],
  );
  const resolvedIssueCount = Math.max(0, issues.length - unresolvedIssueCount);
  const issueResolveCompletion =
    issues.length > 0 ? Math.round((resolvedIssueCount / issues.length) * 100) : 100;

  const canContinueDraft = importedCsv.rows.length > 0 && blockingErrorCount === 0;
  const configuredStallTimeoutMs = getAIStreamStallTimeoutMs();

  const handleGridCellValueChanged = useCallback(
    (event: CellValueChangedEvent<GuidedGridRow>) => {
      if (readOnly) {
        return;
      }
      const rowId = event.data?.rowId;
      const field = event.colDef.field as StandardField | "ignored" | "rowId" | undefined;
      if (rowId === undefined || !field || field === "rowId") {
        return;
      }

      if (field === "ignored") {
        const nextIgnored = Boolean(event.newValue);
        setIgnoredRows((prev: number[]) => {
          const has = prev.includes(rowId);
          if (nextIgnored && !has) {
            return [...prev, rowId];
          }
          if (!nextIgnored && has) {
            return prev.filter((id: number) => id !== rowId);
          }
          return prev;
        });
        return;
      }

      setEdits((prev: Record<number, Record<string, string>>) => ({
        ...prev,
        [rowId]: {
          ...(prev[rowId] ?? {}),
          [field]: String(event.newValue ?? ""),
        },
      }));
    },
    [readOnly, setEdits, setIgnoredRows],
  );

  const fillMissingServiceNamesByAI = useCallback(async () => {
    if (readOnly) {
      return;
    }
    setSemanticReasonPreview(null);
    const targetRows = (activeIssueFilterKey ? filteredRows : rows).filter((row) => {
      const edited = String(edits[row.rowId]?.serviceName ?? "").trim();
      const current = String(row.vm.serviceName ?? "").trim();
      if (edited.length > 0) {
        return false;
      }
      return current.length === 0 || current === "unknown";
    });
    if (targetRows.length === 0) {
      setNotice("当前没有需要 AI 识别的空服务名行。");
      return;
    }

    const requestSeq = ++aiRequestSeqRef.current;
    const stallTimeoutMs = configuredStallTimeoutMs;
    bulkCancelRequestedRef.current = false;
    setSemanticLoadingType("bulk");
    setSingleLoadingRowId(null);
    setBulkProgress({ current: 0, total: targetRows.length });
    try {
      const bulkRows = targetRows;
      const chunkCount = Math.ceil(bulkRows.length / AI_BULK_CHUNK_SIZE);
      const mergedSuggestions: Awaited<ReturnType<typeof inferMissingServiceNames>> = [];
      let timeoutChunks = 0;

      for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        if (bulkCancelRequestedRef.current) {
          break;
        }
        const start = chunkIndex * AI_BULK_CHUNK_SIZE;
        const chunkRows = bulkRows.slice(start, start + AI_BULK_CHUNK_SIZE);
        let chunkSuggestions: Awaited<ReturnType<typeof inferMissingServiceNames>> = [];
        let chunkWasStalled = false;
        for (let attempt = 0; attempt <= AI_BULK_CHUNK_RETRY_TIMES; attempt += 1) {
          let chunkStalled = false;
          const response = await inferMissingServiceNames(
            chunkRows.map((row) => ({
              rowId: row.rowId,
              hostname: row.vm.hostname,
              privateIp: row.vm.privateIp,
              environment: row.vm.environment,
              cpuCores: row.vm.cpuCores,
              memoryGb: row.vm.memoryGb,
              raw: row.raw,
            })),
            {
              stallTimeoutMs,
              onStall: () => {
                chunkStalled = true;
              },
            },
          );
          chunkSuggestions = response;
          chunkWasStalled = chunkStalled;
          if (requestSeq !== aiRequestSeqRef.current) {
            return;
          }
          if (!chunkStalled) {
            break;
          }
          abortSemanticInference();
          if (attempt < AI_BULK_CHUNK_RETRY_TIMES) {
            await new Promise((resolve) => setTimeout(resolve, 180));
          }
        }
        setBulkProgress((prev) =>
          prev
            ? {
              ...prev,
              current: Math.min(prev.total, prev.current + chunkRows.length),
            }
            : prev,
        );
        if (chunkWasStalled) {
          timeoutChunks += 1;
          continue;
        }
        mergedSuggestions.push(...chunkSuggestions);
      }
      if (bulkCancelRequestedRef.current) {
        setNotice("已手动中断批量 AI 补全。");
        return;
      }

      if (mergedSuggestions.length === 0) {
        setNotice(
          timeoutChunks > 0
            ? "AI 批量补全流式响应中断，请重试或改用单元格 AI。"
            : "AI 暂未给出可靠建议，请手动补全。",
        );
        return;
      }

      const appliedCells: Array<{ rowId: number; field: StandardField }> = [];
      let appliedCount = 0;

      setEdits((prev: Record<number, Record<string, string>>) => {
        const next = { ...prev };
        mergedSuggestions.forEach((item) => {
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
      const firstReason = mergedSuggestions.find((item) => item.reason)?.reason;
      if (firstReason) {
        setSemanticReasonPreview(firstReason);
      }
      if (timeoutChunks > 0) {
        setNotice(
          `已补全 ${appliedCount} 个空白服务名（部分分片响应中断，建议重试）。`,
        );
      } else {
        setNotice(`已补全 ${appliedCount} 个空白服务名。`);
      }
    } finally {
      if (requestSeq === aiRequestSeqRef.current) {
        setSemanticLoadingType(null);
        setBulkProgress(null);
      }
    }
  }, [
    abortSemanticInference,
    activeIssueFilterKey,
    edits,
    filteredRows,
    inferMissingServiceNames,
    markAiUpdatedCells,
    rows,
    readOnly,
    setEdits,
  ]);

  const cancelBulkAiFill = useCallback(() => {
    if (semanticLoadingType !== "bulk") {
      return;
    }
    bulkCancelRequestedRef.current = true;
    abortSemanticInference();
  }, [abortSemanticInference, semanticLoadingType]);

  const fillSingleServiceNameByAI = useCallback(
    async (rowId: number) => {
      if (readOnly) {
        return;
      }
      const row = rows.find((item) => item.rowId === rowId);
      if (!row) {
        return;
      }
      setSemanticReasonPreview(null);
      const requestSeq = ++aiRequestSeqRef.current;
      const stallTimeoutMs = configuredStallTimeoutMs;
      setSemanticLoadingType("single");
      setSingleLoadingRowId(rowId);
      try {
        const inputRow = {
          rowId: row.rowId,
          hostname: row.vm.hostname,
          privateIp: row.vm.privateIp,
          environment: row.vm.environment,
          cpuCores: row.vm.cpuCores,
          memoryGb: row.vm.memoryGb,
          raw: row.raw,
        };
        let suggestions: Awaited<ReturnType<typeof inferMissingServiceNames>> = [];
        let stalled = false;
        for (let attempt = 0; attempt <= AI_SINGLE_RETRY_TIMES; attempt += 1) {
          let attemptStalled = false;
          suggestions = await inferMissingServiceNames([inputRow], {
            stallTimeoutMs,
            onStall: () => {
              attemptStalled = true;
            },
          });
          stalled = attemptStalled;
          if (!attemptStalled && suggestions.length > 0) {
            break;
          }
          if (attemptStalled) {
            abortSemanticInference();
          }
        }
        if (requestSeq !== aiRequestSeqRef.current) {
          return;
        }
        if (stalled) {
          setNotice(`第 ${rowId} 行 AI 流式响应中断，请重试。`);
          return;
        }
        const suggestion = suggestions.find(
          (item) => item.rowId === rowId && item.serviceName && item.serviceName !== "unknown",
        );
        if (!suggestion) {
          setNotice(`第 ${rowId} 行暂无可靠 AI 建议，请手动填写。`);
          return;
        }
        setEdits((prev: Record<number, Record<string, string>>) => ({
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
      } finally {
        if (requestSeq === aiRequestSeqRef.current) {
          setSemanticLoadingType(null);
          setSingleLoadingRowId(null);
        }
      }
    },
    [abortSemanticInference, inferMissingServiceNames, markAiUpdatedCells, readOnly, rows, setEdits],
  );

  useEffect(() => {
    if (tablePage > tableTotalPages) {
      setTablePage(tableTotalPages);
    }
  }, [tablePage, tableTotalPages]);

  useEffect(() => {
    if (hasDismissedFullscreenHint) {
      return;
    }
    const shouldSuggestByRows = rows.length >= 100;
    const tableWrap = tableWrapRef.current;
    const shouldSuggestByOverflow =
      !!tableWrap && tableWrap.scrollWidth > tableWrap.clientWidth + 12;

    if (shouldSuggestByRows || shouldSuggestByOverflow) {
      setShowFullscreenHint(true);
    }
  }, [hasDismissedFullscreenHint, rows.length]);

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
        editable: !readOnly,
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
        editable: !readOnly,
        ...(field === "serviceName"
          ? {
            headerComponent: "serviceNameHeader",
            headerComponentParams: {
              onAiFill: fillMissingServiceNamesByAI,
              busy: semanticBusy,
              disabled: semanticBusy || readOnly,
            },
            cellRenderer: "serviceNameCellRenderer",
            cellRendererParams: {
              onAiFillSingle: fillSingleServiceNameByAI,
              aiBusy: semanticLoadingType === "single",
              singleLoadingRowId,
              readOnly,
            },
          }
          : {}),
        cellClass: (params: CellClassParams<GuidedGridRow, string>) => {
          const rowId = params.data?.rowId;
          if (rowId === undefined) {
            return undefined;
          }

          const classes: string[] = [];
          const isIssueField = issueFieldKeySet.has(`${rowId}:${field}`);
          const isActiveGroupField =
            !!activeIssueGroup &&
            activeIssueGroup.items.some(
              (issue) => issue.field === field && issue.rowId === rowId,
            );

          if (isIssueField) {
            classes.push("ai-architecture-generation-dialog__cell-has-issue");
          }
          if (isActiveGroupField) {
            classes.push("ai-architecture-generation-dialog__cell-has-active-issue");
          }
          if (aiUpdatedCells[`${rowId}:${field}`]) {
            classes.push("ai-architecture-generation-dialog__cell-ai-updated");
          }

          return classes.length > 0 ? classes.join(" ") : undefined;
        },
      })),
    ],
    [
      activeIssueGroup,
      aiUpdatedCells,
      fillMissingServiceNamesByAI,
      fillSingleServiceNameByAI,
      issueFieldKeySet,
      readOnly,
      semanticBusy,
      singleLoadingRowId,
    ],
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
    <div className="ai-architecture-generation-dialog__step ai-architecture-generation-dialog__step--workspace">
      <header className="ai-architecture-generation-dialog__workspace-header">
        <h3>问题修复工作台</h3>
        <div className="ai-architecture-generation-dialog__workspace-meta">
          <span className={blockingErrorCount > 0 ? "is-error" : "is-success"}>
            {blockingErrorCount > 0
              ? `还有 ${blockingErrorCount} 个阻断性问题需要修复`
              : "所有阻断性问题已修复"}
          </span>
        </div>
        <button
          type="button"
          className="ai-architecture-generation-dialog__btn-primary"
          onClick={onContinueDraft}
          disabled={!canContinueDraft || readOnly}
        >
          进入草图生成
        </button>
      </header>

      {notice && <div className="ai-architecture-generation-dialog__success">{notice}</div>}
      <div className="ai-architecture-generation-dialog__progress-inline-compact">
        <div className="ai-architecture-generation-dialog__progress-inline-item">
          <strong>修复摘要：</strong>
          <span>
            {resolvedIssueCount}/{issues.length}（{issueResolveCompletion}%）
          </span>
        </div>
        <span className="ai-architecture-generation-dialog__progress-inline-separator" />
        <div className="ai-architecture-generation-dialog__progress-inline-item">
          <strong>阻断：</strong>
          <span>{blockingErrorCount}</span>
        </div>
        <span className="ai-architecture-generation-dialog__progress-inline-separator" />
        <div className="ai-architecture-generation-dialog__progress-inline-item">
          <span>
            {canContinueDraft
              ? "已满足进入草图确认条件"
              : "请先修复阻断问题后进入草图确认"}
          </span>
        </div>
      </div>

      <div className="ai-architecture-generation-dialog__issue-strip">
        {groupedIssues.length === 0 ? (
          <span className="ai-architecture-generation-dialog__empty-state">无待确认问题</span>
        ) : (
          groupedIssues.map((group) => (
            <button
              key={group.key}
              type="button"
              className={`ai-architecture-generation-dialog__issue-pill ${activeIssueGroup?.key === group.key ? "is-active" : ""} ${group.severity === "error" ? "is-error" : "is-warning"}`}
              onClick={() =>
                onActiveIssueFilterKeyChange(
                  activeIssueGroup?.key === group.key ? null : group.key,
                )
              }
            >
              <span className="ai-architecture-generation-dialog__pill-title">{group.title}</span>
              <span className="ai-architecture-generation-dialog__pill-badge">{group.count}</span>
              <span className="ai-architecture-generation-dialog__pill-progress">
                {group.resolvedCount}/{group.count}
              </span>
            </button>
          ))
        )}
      </div>

      <section className="ai-architecture-generation-dialog__workspace-table">
        <div className="ai-architecture-generation-dialog__table-toolbar">
          <div className="ai-architecture-generation-dialog__toolbar-group">
            <strong>资产明细表</strong>
            <span className="ai-architecture-generation-dialog__summary">共 {filteredRows.length} 台</span>
          </div>

          <div className="ai-architecture-generation-dialog__toolbar-group">
            <button
              type="button"
              className="ai-architecture-generation-dialog__icon-btn"
              aria-label={isFullscreenEditing ? "退出全屏编辑" : "进入全屏编辑"}
              title={isFullscreenEditing ? "退出全屏编辑" : "进入全屏编辑"}
              onClick={() => {
                setIsFullscreenEditing((prev) => !prev);
                setShowFullscreenHint(false);
                setHasDismissedFullscreenHint(true);
              }}
              disabled={readOnly}
            >
              {isFullscreenEditing ? "⤡" : "⤢"}
            </button>
          </div>
        </div>

        {semanticReasonPreview && (
          <div className="ai-architecture-generation-dialog__next-tip">
            <strong>AI 识别依据:</strong> {semanticReasonPreview}
          </div>
        )}
        {semanticLoadingType === "bulk" && bulkProgress && (
          <div className="ai-architecture-generation-dialog__next-tip">
            批量 AI 补全进行中：{bulkProgress.current}/{bulkProgress.total}，当前卡住阈值 {Math.floor(configuredStallTimeoutMs / 1000)} 秒，如需提前结束可点击“中断”。
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-ghost"
              onClick={cancelBulkAiFill}
              disabled={readOnly}
            >
              中断
            </button>
          </div>
        )}

        {showFullscreenHint && (
          <div className="ai-architecture-generation-dialog__next-tip">
            数据量较大，建议进入全屏编辑模式以提高效率。
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-ghost"
              onClick={() => {
                setIsFullscreenEditing(true);
                setShowFullscreenHint(false);
                setHasDismissedFullscreenHint(true);
              }}
            >
              进入全屏
            </button>
            <button
              type="button"
              className="ai-architecture-generation-dialog__btn-ghost"
              onClick={() => {
                setShowFullscreenHint(false);
                setHasDismissedFullscreenHint(true);
              }}
            >
              忽略
            </button>
          </div>
        )}

        <div
          ref={tableWrapRef}
          className={`ai-architecture-generation-dialog__table-wrap${isFullscreenEditing ? " is-fullscreen" : ""}`}
        >
          <SharedAgGrid<GuidedGridRow>
            rowData={tableRowData}
            columnDefs={tableColDefs}
            components={{
              serviceNameHeader: ServiceNameHeader,
              serviceNameCellRenderer: ServiceNameCellRenderer,
            }}
            getRowId={(params) => String(params.data.rowId)}
            onCellValueChanged={handleGridCellValueChanged}
          />
        </div>

        <div className="ai-architecture-generation-dialog__pagination">
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
            onClick={() => setTablePage((prev) => Math.min(tableTotalPages, prev + 1))}
            disabled={safeTablePage >= tableTotalPages}
          >
            下一页
          </button>
        </div>
      </section>
    </div>
  );
};
