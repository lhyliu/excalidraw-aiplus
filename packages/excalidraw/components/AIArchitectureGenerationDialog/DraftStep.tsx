import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  editsAtom,
  normalizedVmRowsAtom,
  serviceGroupsAtom,
} from "../AIArchitectureGeneration";
import type { ServiceGroup } from "../AIArchitectureGeneration";
import { useApp } from "../App";
import {
  convertMermaidToExcalidraw,
  insertToEditor,
} from "../TTDDialog/common";
import type { MermaidToExcalidrawLibProps } from "../TTDDialog/types";
import { useUIAppState } from "../../context/ui-appState";
import type { BinaryFiles } from "../../types";

import type { BusinessArchitectureSuggestion } from "./prompt/businessArchitecturePrompt";
import { useBusinessArchitectureSuggestion } from "./hooks/useBusinessArchitectureSuggestion";
import { useBusinessScopeSuggestion } from "./hooks/useBusinessScopeSuggestion";
import { useServiceNamingSuggestion } from "./hooks/useServiceNamingSuggestion";
import { SharedAgGrid } from "./SharedAgGrid";
import {
  projectBusinessScopes,
  projectBusinessScopesByAssignments,
} from "./utils/businessScope";
import { projectDraftGroups } from "./utils/draftProjection";

const parseRowIdsInput = (raw: string): number[] =>
  raw
    .split(/[,\s，]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

interface DraftStepProps {
  onContinueCalibrate: () => void;
  onInsertToCanvas: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  suggestions: Record<string, string[]>;
  onSuggestionsChange: (value: Record<string, string[]>) => void;
}

type DraftGridRow = {
  rowId: number;
  hostname: string;
  privateIp: string;
  serviceName: string;
  environment: string;
};

export const DraftStep: React.FC<DraftStepProps> = ({
  onContinueCalibrate,
  onInsertToCanvas,
  filter,
  onFilterChange,
  suggestions,
  onSuggestionsChange,
}) => {
  const groups = useAtomValue(serviceGroupsAtom);
  const rows = useAtomValue(normalizedVmRowsAtom);
  const [edits, setEdits] = useAtom(editsAtom);
  const { requestSuggestions, isStreaming } = useServiceNamingSuggestion();
  const {
    requestBusinessArchitecture,
    isStreaming: isBusinessArchitectureStreaming,
  } = useBusinessArchitectureSuggestion();
  const { requestBusinessScopes, isStreaming: isBusinessScopeStreaming } =
    useBusinessScopeSuggestion();

  // --- Mermaid preview & canvas insertion ---
  const app = useApp();
  const { theme } = useUIAppState();
  const canvasRef = useRef<HTMLDivElement>(null);
  const mermaidDataRef = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });
  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
    useState<MermaidToExcalidrawLibProps>({
      loaded: false,
      api: import("@excalidraw/mermaid-to-excalidraw"),
    });
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [activeDiagramScopeId, setActiveDiagramScopeId] = useState<string | null>(null);

  useEffect(() => {
    const fn = async () => {
      await mermaidToExcalidrawLib.api;
      setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
    };
    fn();
  }, [mermaidToExcalidrawLib.api]);

  const loadSuggestions = useCallback(
    async (group: ServiceGroup) => {
      const result = await requestSuggestions(group, rows);
      onSuggestionsChange({
        ...suggestions,
        [group.id]: result,
      });
    },
    [onSuggestionsChange, requestSuggestions, rows, suggestions],
  );

  const applySuggestion = useCallback(
    (group: ServiceGroup, suggestedName: string) => {
      setEdits((prev) => {
        const next = { ...prev };
        group.rowIds.forEach((rowId) => {
          next[rowId] = {
            ...(next[rowId] ?? {}),
            serviceName: suggestedName,
          };
        });
        return next;
      });
    },
    [setEdits],
  );

  const views = projectDraftGroups(groups, rows).filter((view) =>
    filter ? view.name.toLowerCase().includes(filter.toLowerCase()) : true,
  );
  const fallbackBusinessScopes = useMemo(
    () => projectBusinessScopes(groups, rows),
    [groups, rows],
  );
  const [aiBusinessScopes, setAiBusinessScopes] = useState<
    ReturnType<typeof projectBusinessScopes> | null
  >(null);
  const businessScopes = aiBusinessScopes ?? fallbackBusinessScopes;
  const scopeInferenceSignatureRef = useRef<string>("");
  const scopeInferenceSignature = useMemo(() => {
    const groupSignature = groups
      .map((group) => `${group.id}:${group.name}:${group.rowIds.join(",")}`)
      .join("|");
    const rowSignature = rows
      .slice(0, 40)
      .map(
        (row) =>
          `${row.rowId}:${row.vm.hostname}:${row.vm.privateIp}:${row.vm.serviceName}`,
      )
      .join("|");
    return `${groupSignature}::${rows.length}::${rowSignature}`;
  }, [groups, rows]);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [diagramByScope, setDiagramByScope] = useState<Record<string, string>>({});
  const [businessSuggestionByScope, setBusinessSuggestionByScope] = useState<
    Record<string, BusinessArchitectureSuggestion>
  >({});
  const [editableLayersByScope, setEditableLayersByScope] = useState<
    Record<string, BusinessArchitectureSuggestion["layers"]>
  >({});
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = useState<number | null>(null);
  const scopeByGroupId = useMemo(
    () =>
      businessScopes.reduce(
        (acc, scope) => {
          scope.groupIds.forEach((groupId) => {
            acc[groupId] = scope.id;
          });
          return acc;
        },
        {} as Record<string, string>,
      ),
    [businessScopes],
  );
  const selectedScope = useMemo(
    () => businessScopes.find((scope) => scope.id === selectedScopeId) ?? null,
    [businessScopes, selectedScopeId],
  );
  const filteredViews = useMemo(
    () =>
      views.filter((view) => {
        if (!selectedScope) {
          return false;
        }
        const scopeId = scopeByGroupId[view.id];
        return scopeId === selectedScope.id;
      }),
    [scopeByGroupId, selectedScope, views],
  );
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);
  const selectedRowIds = useMemo(() => {
    if (!selectedScope) {
      return new Set<number>();
    }
    return new Set(selectedScope.rowIds);
  }, [selectedScope]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowIds.has(row.rowId)),
    [rows, selectedRowIds],
  );
  const selectedRowById = useMemo(
    () =>
      selectedRows.reduce(
        (acc, row) => {
          acc[row.rowId] = row;
          return acc;
        },
        {} as Record<number, (typeof selectedRows)[number]>,
      ),
    [selectedRows],
  );
  const totalPages = Math.max(1, Math.ceil(selectedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return selectedRows.slice(start, start + pageSize);
  }, [pageSize, safePage, selectedRows]);
  const draftTableRows = useMemo<DraftGridRow[]>(
    () =>
      pageRows.map((row) => ({
        rowId: row.rowId,
        hostname: row.vm.hostname,
        privateIp: row.vm.privateIp,
        serviceName: String(edits[row.rowId]?.serviceName ?? row.vm.serviceName ?? ""),
        environment: row.vm.environment,
      })),
    [edits, pageRows],
  );
  const draftTableColDefs = useMemo<ColDef<DraftGridRow>[]>(
    () => [
      {
        headerName: "拖拽",
        field: "rowId",
        width: 92,
        minWidth: 92,
        maxWidth: 92,
        sortable: false,
        suppressMovable: true,
        cellRenderer: (params: ICellRendererParams<DraftGridRow, number>) => {
          const rowId = params.data?.rowId;
          if (rowId === undefined) {
            return null;
          }
          return (
            <button
              type="button"
              className="ai-architecture-generation-dialog__drag-chip"
              aria-label={`拖拽资产-${rowId}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", String(rowId));
                setDraggingRowId(rowId);
              }}
              onDragEnd={() => {
                setDraggingRowId(null);
                setDragOverLayerIndex(null);
              }}
            >
              拖拽
            </button>
          );
        },
      },
      {
        headerName: "rowId",
        field: "rowId",
        width: 90,
        minWidth: 90,
        maxWidth: 100,
        suppressMovable: true,
      },
      {
        headerName: "hostname",
        field: "hostname",
        minWidth: 180,
        flex: 1,
        suppressMovable: true,
      },
      {
        headerName: "privateIp",
        field: "privateIp",
        minWidth: 160,
        flex: 1,
        suppressMovable: true,
      },
      {
        headerName: "serviceName",
        field: "serviceName",
        minWidth: 180,
        flex: 1,
        suppressMovable: true,
      },
      {
        headerName: "environment",
        field: "environment",
        minWidth: 140,
        flex: 1,
        suppressMovable: true,
      },
    ],
    [],
  );

  const refreshBusinessScopes = useCallback(async () => {
    if (groups.length === 0 || rows.length === 0) {
      setAiBusinessScopes(null);
      return;
    }
    const suggestion = await requestBusinessScopes(groups, rows);
    if (!suggestion) {
      setAiBusinessScopes(null);
      return;
    }
    const projected = projectBusinessScopesByAssignments(
      suggestion.scopes.map((scope) => ({
        name: scope.name,
        groupIds: scope.groupIds,
      })),
      groups,
      rows,
    );
    setAiBusinessScopes(projected.length > 0 ? projected : null);
  }, [groups, requestBusinessScopes, rows]);

  useEffect(() => {
    if (!scopeInferenceSignature) {
      return;
    }
    if (scopeInferenceSignatureRef.current === scopeInferenceSignature) {
      return;
    }
    scopeInferenceSignatureRef.current = scopeInferenceSignature;
    void refreshBusinessScopes();
  }, [refreshBusinessScopes, scopeInferenceSignature]);

  useEffect(() => {
    if (businessScopes.length === 0) {
      setSelectedScopeId(null);
      return;
    }
    setSelectedScopeId((prev) => {
      if (prev && businessScopes.some((scope) => scope.id === prev)) {
        return prev;
      }
      return businessScopes[0]?.id ?? null;
    });
  }, [businessScopes]);

  const requestScopeArchitecture = useCallback(async () => {
    if (!selectedScope) {
      setGenerationNotice("请先选择业务范围。");
      return null;
    }
    const scopeGroupIdSet = new Set(selectedScope.groupIds);
    const scopeGroups = groups.filter((group) => scopeGroupIdSet.has(group.id));
    const scopeRowIdSet = new Set(selectedScope.rowIds);
    const scopeRows = rows.filter((row) => scopeRowIdSet.has(row.rowId));
    const suggestion = await requestBusinessArchitecture(
      selectedScope.name,
      scopeGroups,
      scopeRows,
    );
    if (!suggestion) {
      setGenerationNotice("AI 暂未返回有效架构草图，请调整数据后重试。");
      return null;
    }
    setBusinessSuggestionByScope((prev) => ({
      ...prev,
      [selectedScope.id]: suggestion,
    }));
    setEditableLayersByScope((prev) => ({
      ...prev,
      [selectedScope.id]: suggestion.layers.map((layer) => ({ ...layer })),
    }));
    return suggestion;
  }, [groups, requestBusinessArchitecture, rows, selectedScope]);

  const updateEditableLayer = useCallback(
    (
      scopeId: string,
      layerIndex: number,
      patch: Partial<BusinessArchitectureSuggestion["layers"][number]>,
    ) => {
      setEditableLayersByScope((prev) => {
        const current = prev[scopeId] ?? [];
        const next = current.map((layer, idx) =>
          idx === layerIndex ? { ...layer, ...patch } : layer,
        );
        return {
          ...prev,
          [scopeId]: next,
        };
      });
    },
    [],
  );

  const applyLayerAdjustments = useCallback(() => {
    if (!selectedScope) {
      return;
    }
    const editableLayers = editableLayersByScope[selectedScope.id] ?? [];
    setBusinessSuggestionByScope((prev) => {
      const current = prev[selectedScope.id];
      if (!current) {
        return prev;
      }
      return {
        ...prev,
        [selectedScope.id]: {
          ...current,
          layers: editableLayers,
        },
      };
    });
    setGenerationNotice(`已应用「${selectedScope.name}」分层调整。`);
  }, [editableLayersByScope, selectedScope]);

  const assignRowToLayer = useCallback(
    (scopeId: string, targetLayerIndex: number, rowId: number) => {
      setEditableLayersByScope((prev) => {
        const current = prev[scopeId] ?? [];
        const next = current.map((layer, idx) => {
          const removed = layer.rowIds.filter((id) => id !== rowId);
          if (idx !== targetLayerIndex) {
            return {
              ...layer,
              rowIds: removed,
            };
          }
          return {
            ...layer,
            rowIds: Array.from(new Set([...removed, rowId])),
          };
        });
        return {
          ...prev,
          [scopeId]: next,
        };
      });
    },
    [],
  );

  const generateDiagramByScope = useCallback(async () => {
    if (!selectedScope) {
      setGenerationNotice("请先选择业务范围。");
      return;
    }
    setIsGeneratingDiagram(true);
    setGenerationNotice(null);
    try {
      let suggestion = businessSuggestionByScope[selectedScope.id];
      if (!suggestion) {
        suggestion = await requestScopeArchitecture();
      }
      if (!suggestion?.mermaid) {
        return;
      }
      setDiagramByScope((prev) => ({
        ...prev,
        [selectedScope.id]: suggestion.mermaid,
      }));
      setActiveDiagramScopeId(selectedScope.id);
      setGenerationNotice(`已生成「${selectedScope.name}」业务架构图。`);
    } finally {
      setIsGeneratingDiagram(false);
    }
  }, [businessSuggestionByScope, requestScopeArchitecture, selectedScope]);

  // Render Mermaid preview when the active diagram changes
  useEffect(() => {
    if (!activeDiagramScopeId || !mermaidToExcalidrawLib.loaded) {
      return;
    }
    const mermaidCode = diagramByScope[activeDiagramScopeId];
    if (!mermaidCode) {
      return;
    }
    void convertMermaidToExcalidraw({
      canvasRef,
      data: mermaidDataRef,
      mermaidToExcalidrawLib,
      setError: setPreviewError,
      mermaidDefinition: mermaidCode,
      theme,
    });
  }, [activeDiagramScopeId, diagramByScope, mermaidToExcalidrawLib, theme]);

  const handleInsertToCanvas = useCallback(() => {
    if (mermaidDataRef.current.elements.length === 0) {
      setGenerationNotice("请先生成架构图后再插入画布。");
      return;
    }
    const mermaidText = activeDiagramScopeId
      ? diagramByScope[activeDiagramScopeId]
      : undefined;
    insertToEditor({
      app,
      data: mermaidDataRef,
      text: mermaidText,
      shouldSaveMermaidDataToStorage: true,
    });
    onInsertToCanvas();
  }, [activeDiagramScopeId, app, diagramByScope, onInsertToCanvas]);

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>草图生成与确认</h3>
      <p>每次只处理一个业务范围，完成分层调整并生成 Mermaid 后再确认插入。</p>
      <div className="ai-architecture-generation-dialog__issue-card">
        <strong>业务范围确认</strong>
        <div className="ai-architecture-generation-dialog__summary">
          已识别业务范围: {businessScopes.length}
        </div>
        <div className="ai-architecture-generation-dialog__summary">
          来源: {aiBusinessScopes ? "AI 推断" : "本地回退分组"}
        </div>
        <div className="ai-architecture-generation-dialog__inline-form">
          <label>
            当前业务范围
            <select
              aria-label="当前业务范围"
              value={selectedScopeId ?? ""}
              onChange={(event) => setSelectedScopeId(event.target.value || null)}
            >
              {businessScopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name} ({scope.vmCount})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refreshBusinessScopes()}
            disabled={isBusinessScopeStreaming}
          >
            {isBusinessScopeStreaming ? "识别中..." : "AI 重新识别范围"}
          </button>
        </div>
      </div>
      <div className="ai-architecture-generation-dialog__inline-form">
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="按服务名筛选"
        />
      </div>
      <div className="ai-architecture-generation-dialog__issue-groups">
        {filteredViews.length === 0 && (
          <div className="ai-architecture-generation-dialog__error">
            当前没有匹配的服务分组，请调整筛选条件或先勾选业务范围。
          </div>
        )}
        {filteredViews.map((view) => {
          const group = groups.find((item) => item.id === view.id);
          if (!group) {
            return null;
          }
          return (
            <article
              key={view.id}
              className="ai-architecture-generation-dialog__issue-card"
            >
              <strong>{view.name}</strong>
              <div>VMs: {view.vmCount}</div>
              <div>confidence: {view.confidence.toFixed(2)}</div>
              <div>推断依据: {view.reason}</div>
              <div>业务范围: {businessScopes.find((scope) => scope.id === scopeByGroupId[group.id])?.name ?? "未分类业务"}</div>
              <button
                type="button"
                onClick={() => loadSuggestions(group)}
                disabled={isStreaming}
              >
                AI 命名建议
              </button>
              {(suggestions[group.id] ?? []).map((name) => (
                <div
                  key={`${group.id}:${name}`}
                  className="ai-architecture-generation-dialog__inline-form"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => applySuggestion(group, name)}
                  >
                    应用
                  </button>
                </div>
              ))}
            </article>
          );
        })}
      </div>
      {selectedScope && (
        <div className="ai-architecture-generation-dialog__issue-card">
          <strong>AI 业务分层建议</strong>
          <div className="ai-architecture-generation-dialog__summary">
            范围: {selectedScope.name}
          </div>
          <div className="ai-architecture-generation-dialog__summary">
            可将下方资产拖拽到层卡片，快速调整分层归属。
          </div>
          <div className="ai-architecture-generation-dialog__inline-form">
            <button
              type="button"
              onClick={requestScopeArchitecture}
              disabled={isBusinessArchitectureStreaming}
            >
              {isBusinessArchitectureStreaming ? "AI 分析中..." : "AI 分析分层"}
            </button>
          </div>
          {businessSuggestionByScope[selectedScope.id]?.summary && (
            <div>{businessSuggestionByScope[selectedScope.id].summary}</div>
          )}
          <div className="ai-architecture-generation-dialog__layer-board">
            {(editableLayersByScope[selectedScope.id] ??
              businessSuggestionByScope[selectedScope.id]?.layers ??
              []
            ).map((layer, index) => (
              <article
                key={`${selectedScope.id}:${index}:${layer.name}`}
                className="ai-architecture-generation-dialog__layer-lane"
              >
                <div className="ai-architecture-generation-dialog__layer-head">
                  <label>
                    层名称
                    <input
                      aria-label={`层名称-${index}`}
                      value={layer.name}
                      onChange={(event) =>
                        updateEditableLayer(selectedScope.id, index, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="ai-architecture-generation-dialog__summary">
                    资产数: {layer.rowIds.length}
                  </div>
                </div>
                {layer.description && <div>{layer.description}</div>}
                <div
                  className="ai-architecture-generation-dialog__layer-dropzone"
                  aria-label={`层卡片-${index}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggingRowId !== null) {
                      setDragOverLayerIndex(index);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverLayerIndex === index) {
                      setDragOverLayerIndex(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = Number(event.dataTransfer.getData("text/plain"));
                    if (!Number.isFinite(dropped) || dropped <= 0) {
                      return;
                    }
                    assignRowToLayer(selectedScope.id, index, dropped);
                    setDragOverLayerIndex(null);
                    setDraggingRowId(null);
                    setGenerationNotice(
                      `已将资产 Row ${dropped} 分配到「${layer.name}」。`,
                    );
                  }}
                  data-drop-active={dragOverLayerIndex === index ? "true" : "false"}
                >
                  {layer.rowIds.length === 0 ? (
                    <div className="ai-architecture-generation-dialog__summary">
                      将左侧资产拖到这里完成分层
                    </div>
                  ) : (
                    <div className="ai-architecture-generation-dialog__layer-assets">
                      {layer.rowIds.map((rowId) => {
                        const row = selectedRowById[rowId];
                        return (
                          <div
                            key={`${selectedScope.id}:${index}:row-${rowId}`}
                            className="ai-architecture-generation-dialog__layer-asset-chip"
                            title={
                              row
                                ? `Row ${rowId} · ${row.vm.hostname} · ${row.vm.privateIp}`
                                : `Row ${rowId}`
                            }
                          >
                            Row {rowId}
                            {row ? ` · ${row.vm.hostname}` : ""}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <label>
                  层资产 rowIds
                  <input
                    aria-label={`层资产-${index}`}
                    value={layer.rowIds.join(",")}
                    onChange={(event) =>
                      updateEditableLayer(selectedScope.id, index, {
                        rowIds: parseRowIdsInput(event.target.value),
                      })
                    }
                  />
                </label>
                {layer.reason && (
                  <div className="ai-architecture-generation-dialog__summary">
                    依据: {layer.reason}
                  </div>
                )}
              </article>
            ))}
          </div>
          {(editableLayersByScope[selectedScope.id] ?? []).length > 0 && (
            <div className="ai-architecture-generation-dialog__inline-form">
              <button type="button" onClick={applyLayerAdjustments}>
                应用分层调整
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ai-architecture-generation-dialog__table-wrap">
        <SharedAgGrid<DraftGridRow>
          rowData={draftTableRows}
          columnDefs={draftTableColDefs}
        />
      </div>
      <div className="ai-architecture-generation-dialog__inline-form">
        <label>
          每页
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={safePage <= 1}
        >
          上一页
        </button>
        <span>
          第 {safePage}/{totalPages} 页
        </span>
        <span className="ai-architecture-generation-dialog__summary">
          当前范围资产: {selectedRows.length}
        </span>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={safePage >= totalPages}
        >
          下一页
        </button>
      </div>
      <div className="ai-architecture-generation-dialog__actions">
        <button
          type="button"
          className="ai-architecture-generation-dialog__btn-secondary"
          onClick={generateDiagramByScope}
          disabled={isGeneratingDiagram || isBusinessArchitectureStreaming || !selectedScope}
        >
          {isGeneratingDiagram ? "生成中..." : "生成当前业务架构图"}
        </button>
        <button
          type="button"
          className="ai-architecture-generation-dialog__btn-primary"
          onClick={handleInsertToCanvas}
          disabled={
            !activeDiagramScopeId ||
            !diagramByScope[activeDiagramScopeId] ||
            Boolean(previewError)
          }
        >
          确认并插入画布
        </button>
        <button
          type="button"
          className="ai-architecture-generation-dialog__btn-ghost"
          onClick={onContinueCalibrate}
        >
          返回问题修复
        </button>
      </div>
      {generationNotice && (
        <div className="ai-architecture-generation-dialog__summary">{generationNotice}</div>
      )}
      {Object.keys(diagramByScope).length > 0 && (
        <>
          <div className="ai-architecture-generation-dialog__issue-card">
            <strong>
              {activeDiagramScopeId
                ? `${businessScopes.find((scope) => scope.id === activeDiagramScopeId)?.name ?? activeDiagramScopeId} 架构图预览`
                : "架构图预览"}
            </strong>
            {previewError && (
              <div className="ai-architecture-generation-dialog__error">
                Mermaid 渲染失败: {previewError.message}
              </div>
            )}
            <div className="ai-architecture-generation-dialog__draft-preview-canvas">
              <div ref={canvasRef} />
            </div>
            {Object.keys(diagramByScope).length > 1 && (
              <div className="ai-architecture-generation-dialog__inline-form">
                {Object.keys(diagramByScope).map((scopeId) => {
                  const scopeName =
                    businessScopes.find((scope) => scope.id === scopeId)?.name ?? scopeId;
                  return (
                    <button
                      key={scopeId}
                      type="button"
                      className={`ai-architecture-generation-dialog__btn-ghost${
                        activeDiagramScopeId === scopeId ? " ai-architecture-generation-dialog__btn-primary" : ""
                      }`}
                      onClick={() => setActiveDiagramScopeId(scopeId)}
                    >
                      {scopeName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <details>
            <summary className="ai-architecture-generation-dialog__draft-source-toggle">
              查看 Mermaid 源码
            </summary>
            <div className="ai-architecture-generation-dialog__issue-groups">
              {Object.entries(diagramByScope).map(([scopeId, diagram]) => {
                const scopeName =
                  businessScopes.find((scope) => scope.id === scopeId)?.name ?? scopeId;
                return (
                  <article
                    key={scopeId}
                    className="ai-architecture-generation-dialog__issue-card"
                  >
                    <strong>{scopeName}</strong>
                    <pre>{diagram}</pre>
                  </article>
                );
              })}
            </div>
          </details>
        </>
      )}
    </div>
  );
};
