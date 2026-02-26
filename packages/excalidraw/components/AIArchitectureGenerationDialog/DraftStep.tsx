import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom, useAtomValue } from "../../editor-jotai";
import { useUIAppState } from "../../context/ui-appState";
import type { BinaryFiles } from "../../types";
import {
  editsAtom,
  normalizedVmRowsAtom,
  serviceGroupsAtom,
} from "../AIArchitectureGeneration";
import type {
  DiagramStatus,
  DraftViewMode,
  DraftStage,
  LayerDraft,
  ServiceGroup,
} from "../AIArchitectureGeneration";
import { useApp } from "../App";
import {
  convertMermaidToExcalidraw,
  insertToEditor,
} from "../TTDDialog/common";
import type { MermaidToExcalidrawLibProps } from "../TTDDialog/types";

import { useBusinessArchitectureSuggestion } from "./hooks/useBusinessArchitectureSuggestion";
import { useBusinessScopeSuggestion } from "./hooks/useBusinessScopeSuggestion";
import { useServiceNamingSuggestion } from "./hooks/useServiceNamingSuggestion";
import type { BusinessArchitectureSuggestion } from "./prompt/businessArchitecturePrompt";
import { SharedAgGrid } from "./SharedAgGrid";
import {
  projectBusinessScopes,
  projectBusinessScopesByAssignments,
} from "./utils/businessScope";
import { projectDraftGroups } from "./utils/draftProjection";

const parseRowIdsInput = (raw: string): number[] =>
  raw
    .split(/[\s,，]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

interface DraftStepProps {
  onContinueCalibrate: () => void;
  onInsertToCanvas: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  suggestions: Record<string, string[]>;
  onSuggestionsChange: (value: Record<string, string[]>) => void;
  activeScopeId: string | null;
  onActiveScopeIdChange: (scopeId: string | null) => void;
  selectedScopeIds: string[];
  onSelectedScopeIdsChange: (scopeIds: string[]) => void;
  viewMode: DraftViewMode;
  onViewModeChange: (mode: DraftViewMode) => void;
  layerEditsByScope: Record<string, LayerDraft[]>;
  onLayerEditsByScopeChange: (value: Record<string, LayerDraft[]>) => void;
  diagramByScope: Record<string, string>;
  onDiagramByScopeChange: (value: Record<string, string>) => void;
  diagramStatusByScope: Record<string, DiagramStatus>;
  onDiagramStatusByScopeChange: (value: Record<string, DiagramStatus>) => void;
  panoramaDiagram: string;
  onPanoramaDiagramChange: (value: string) => void;
  panoramaDiagramStatus: DiagramStatus;
  onPanoramaDiagramStatusChange: (value: DiagramStatus) => void;
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
  activeScopeId,
  onActiveScopeIdChange,
  selectedScopeIds,
  onSelectedScopeIdsChange,
  viewMode,
  onViewModeChange,
  layerEditsByScope,
  onLayerEditsByScopeChange,
  diagramByScope,
  onDiagramByScopeChange,
  diagramStatusByScope,
  onDiagramStatusByScopeChange,
  panoramaDiagram,
  onPanoramaDiagramChange,
  panoramaDiagramStatus,
  onPanoramaDiagramStatusChange,
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
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = useState<number | null>(null);
  const [activeRowId, setActiveRowId] = useState<number | null>(null);
  const [aiBusinessScopes, setAiBusinessScopes] = useState<
    ReturnType<typeof projectBusinessScopes> | null
  >(null);
  const [businessSuggestionByScope, setBusinessSuggestionByScope] = useState<
    Record<string, BusinessArchitectureSuggestion>
  >({});
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);
  const initializedScopeSelectionRef = useRef(false);
  const panoramaContextRef = useRef<string>("");

  useEffect(() => {
    const loadLib = async () => {
      await mermaidToExcalidrawLib.api;
      setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
    };
    void loadLib();
  }, [mermaidToExcalidrawLib.api]);

  const views = useMemo(
    () =>
      projectDraftGroups(groups, rows).filter((view) =>
        filter ? view.name.toLowerCase().includes(filter.toLowerCase()) : true,
      ),
    [filter, groups, rows],
  );

  const fallbackBusinessScopes = useMemo(
    () => projectBusinessScopes(groups, rows),
    [groups, rows],
  );
  const businessScopes = aiBusinessScopes ?? fallbackBusinessScopes;
  const panoramaContext = useMemo(
    () => `${viewMode}:${selectedScopeIds.slice().sort().join(",")}`,
    [selectedScopeIds, viewMode],
  );

  useEffect(() => {
    if (businessScopes.length === 0) {
      initializedScopeSelectionRef.current = false;
      onActiveScopeIdChange(null);
      onSelectedScopeIdsChange([]);
      return;
    }
    const validScopeIds = new Set(businessScopes.map((scope) => scope.id));
    const nextSelected = selectedScopeIds.filter((scopeId) => validScopeIds.has(scopeId));
    if (nextSelected.length === 0) {
      if (!initializedScopeSelectionRef.current) {
        initializedScopeSelectionRef.current = true;
        onSelectedScopeIdsChange(businessScopes.map((scope) => scope.id));
      }
      return;
    }
    initializedScopeSelectionRef.current = true;
    if (nextSelected.length !== selectedScopeIds.length) {
      onSelectedScopeIdsChange(nextSelected);
      return;
    }
    if (!activeScopeId || !validScopeIds.has(activeScopeId)) {
      onActiveScopeIdChange(nextSelected[0] ?? businessScopes[0]?.id ?? null);
    }
  }, [
    activeScopeId,
    businessScopes,
    onActiveScopeIdChange,
    onSelectedScopeIdsChange,
    selectedScopeIds,
  ]);

  useEffect(() => {
    if (panoramaContextRef.current && panoramaContextRef.current !== panoramaContext) {
      onPanoramaDiagramStatusChange("idle");
    }
    panoramaContextRef.current = panoramaContext;
  }, [onPanoramaDiagramStatusChange, panoramaContext]);

  const selectedScope = useMemo(
    () => businessScopes.find((scope) => scope.id === activeScopeId) ?? null,
    [activeScopeId, businessScopes],
  );
  const selectedScopeIdSet = useMemo(
    () => new Set(selectedScopeIds),
    [selectedScopeIds],
  );
  const selectedScopes = useMemo(
    () => businessScopes.filter((scope) => selectedScopeIdSet.has(scope.id)),
    [businessScopes, selectedScopeIdSet],
  );
  const focusScope = selectedScope ?? selectedScopes[0] ?? null;

  const selectedScopeLayers = useMemo(
    () => (focusScope ? (layerEditsByScope[focusScope.id] ?? []) : []),
    [focusScope, layerEditsByScope],
  );

  const selectedScopeDiagramStatus = focusScope
    ? (diagramStatusByScope[focusScope.id] ?? "idle")
    : "idle";

  const draftStage: DraftStage = useMemo(() => {
    if (panoramaDiagramStatus === "ready") {
      return "diagramReady";
    }
    if (!focusScope) {
      return "scopeReady";
    }
    if (selectedScopeLayers.length > 0) {
      return "layerReady";
    }
    return "scopeReady";
  }, [focusScope, panoramaDiagramStatus, selectedScopeLayers.length]);

  const updateLayerEditsForScope = useCallback(
    (scopeId: string, layers: LayerDraft[]) => {
      onLayerEditsByScopeChange({
        ...layerEditsByScope,
        [scopeId]: layers,
      });
    },
    [layerEditsByScope, onLayerEditsByScopeChange],
  );

  const refreshBusinessScopes = useCallback(async () => {
    if (groups.length === 0 || rows.length === 0) {
      setAiBusinessScopes(null);
      return;
    }
    const suggestion = await requestBusinessScopes(groups, rows);
    if (!suggestion) {
      setAiBusinessScopes(null);
      setGenerationNotice("AI 未返回业务分区结果，已使用本地分组。");
      return;
    }
    const projected = projectBusinessScopesByAssignments(
      suggestion.scopes.map((scope) => ({ name: scope.name, groupIds: scope.groupIds })),
      groups,
      rows,
    );
    if (projected.length === 0) {
      setAiBusinessScopes(null);
      setGenerationNotice("AI 业务分区结果为空，已使用本地分组。");
      return;
    }
    setAiBusinessScopes(projected);
    setGenerationNotice("已刷新业务分区。");
  }, [groups, requestBusinessScopes, rows]);

  const loadSuggestions = useCallback(
    async (group: ServiceGroup) => {
      const result = await requestSuggestions(group, rows);
      onSuggestionsChange({ ...suggestions, [group.id]: result });
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
      setGenerationNotice(`已应用命名建议：${suggestedName}`);
    },
    [setEdits],
  );

  const requestScopeArchitecture = useCallback(async () => {
    if (!focusScope) {
      setGenerationNotice("请先选择主业务分区。");
      return null;
    }
    const scopeGroupIdSet = new Set(focusScope.groupIds);
    const scopeGroups = groups.filter((group) => scopeGroupIdSet.has(group.id));
    const scopeRowIdSet = new Set(focusScope.rowIds);
    const scopeRows = rows.filter((row) => scopeRowIdSet.has(row.rowId));
    const suggestion = await requestBusinessArchitecture(
      focusScope.name,
      scopeGroups,
      scopeRows,
      {
        targetMode: "focus",
        selectedScopeNames: [focusScope.name],
        detailLevel: "service-level",
      },
    );
    if (!suggestion) {
      setGenerationNotice("AI 暂未返回有效分层建议，请重试。");
      return null;
    }
    setBusinessSuggestionByScope((prev) => ({
      ...prev,
      [focusScope.id]: suggestion,
    }));
    updateLayerEditsForScope(focusScope.id, suggestion.layers);
    onDiagramStatusByScopeChange({
      ...diagramStatusByScope,
      [focusScope.id]: "idle",
    });
    setGenerationNotice(`已生成「${focusScope.name}」分层建议。`);
    return suggestion;
  }, [
    focusScope,
    groups,
    rows,
    requestBusinessArchitecture,
    updateLayerEditsForScope,
    onDiagramStatusByScopeChange,
    diagramStatusByScope,
  ]);

  const updateLayer = useCallback(
    (layerIndex: number, patch: Partial<LayerDraft>) => {
      if (!focusScope) {
        return;
      }
      const current = layerEditsByScope[focusScope.id] ?? [];
      const next = current.map((layer, index) =>
        index === layerIndex ? { ...layer, ...patch } : layer,
      );
      updateLayerEditsForScope(focusScope.id, next);
      onDiagramStatusByScopeChange({
        ...diagramStatusByScope,
        [focusScope.id]: "idle",
      });
    },
    [
      focusScope,
      layerEditsByScope,
      updateLayerEditsForScope,
      onDiagramStatusByScopeChange,
      diagramStatusByScope,
    ],
  );

  const assignRowToLayer = useCallback(
    (targetLayerIndex: number, rowId: number) => {
      if (!focusScope) {
        return;
      }
      const current = layerEditsByScope[focusScope.id] ?? [];
      const next = current.map((layer, index) => {
        const removed = layer.rowIds.filter((id) => id !== rowId);
        if (index !== targetLayerIndex) {
          return { ...layer, rowIds: removed };
        }
        return { ...layer, rowIds: Array.from(new Set([...removed, rowId])) };
      });
      updateLayerEditsForScope(focusScope.id, next);
      onDiagramStatusByScopeChange({
        ...diagramStatusByScope,
        [focusScope.id]: "idle",
      });
      setGenerationNotice(`已将 Row ${rowId} 分配到图层。`);
    },
    [
      focusScope,
      layerEditsByScope,
      updateLayerEditsForScope,
      onDiagramStatusByScopeChange,
      diagramStatusByScope,
    ],
  );

  const generateDiagram = useCallback(async () => {
    if (!focusScope) {
      setGenerationNotice("请先选择主业务分区。");
      return;
    }
    const layers = layerEditsByScope[focusScope.id] ?? [];
    if (layers.length === 0) {
      setGenerationNotice("请先执行 AI 分析分层。");
      return;
    }

    onDiagramStatusByScopeChange({
      ...diagramStatusByScope,
      [focusScope.id]: "generating",
    });
    setGenerationNotice(null);

    try {
      const existing = businessSuggestionByScope[focusScope.id];
      const suggestion = existing ?? (await requestScopeArchitecture());
      if (!suggestion?.mermaid) {
        onDiagramStatusByScopeChange({
          ...diagramStatusByScope,
          [focusScope.id]: "error",
        });
        setGenerationNotice("AI 未返回可用架构图，请重试。");
        return;
      }
      onDiagramByScopeChange({
        ...diagramByScope,
        [focusScope.id]: suggestion.mermaid,
      });
      onDiagramStatusByScopeChange({
        ...diagramStatusByScope,
        [focusScope.id]: "ready",
      });
      setGenerationNotice(`已生成「${focusScope.name}」架构图。`);
    } catch {
      onDiagramStatusByScopeChange({
        ...diagramStatusByScope,
        [focusScope.id]: "error",
      });
      setGenerationNotice("架构图生成失败，请重试。");
    }
  }, [
    focusScope,
    layerEditsByScope,
    diagramStatusByScope,
    onDiagramStatusByScopeChange,
    businessSuggestionByScope,
    requestScopeArchitecture,
    onDiagramByScopeChange,
    diagramByScope,
  ]);

  const generatePanoramaDiagram = useCallback(async () => {
    if (selectedScopes.length === 0) {
      setGenerationNotice("请至少选择一个业务分区。");
      return;
    }
    const selectedScopeNameSet = new Set(selectedScopes.map((scope) => scope.name));
    const selectedGroupIdSet = new Set(selectedScopes.flatMap((scope) => scope.groupIds));
    const selectedRowIdSet = new Set(selectedScopes.flatMap((scope) => scope.rowIds));
    const scopeGroups = groups.filter((group) => selectedGroupIdSet.has(group.id));
    const scopeRows = rows.filter((row) => selectedRowIdSet.has(row.rowId));

    onPanoramaDiagramStatusChange("generating");
    setGenerationNotice(null);
    try {
      const suggestion = await requestBusinessArchitecture(
        "企业业务全景",
        scopeGroups,
        scopeRows,
        {
          targetMode: viewMode,
          selectedScopeNames: Array.from(selectedScopeNameSet),
          detailLevel: "service-level",
        },
      );
      if (!suggestion?.mermaid) {
        onPanoramaDiagramStatusChange("error");
        setGenerationNotice("AI 未返回可用全景图，请重试。");
        return;
      }
      onPanoramaDiagramChange(suggestion.mermaid);
      onPanoramaDiagramStatusChange("ready");
      panoramaContextRef.current = panoramaContext;
      setGenerationNotice(
        suggestion.topologySummary
          ? `已生成全景图：${suggestion.topologySummary}`
          : "已生成全景架构图。",
      );
    } catch {
      onPanoramaDiagramStatusChange("error");
      setGenerationNotice("全景架构图生成失败，请重试。");
    }
  }, [
    groups,
    onPanoramaDiagramChange,
    onPanoramaDiagramStatusChange,
    requestBusinessArchitecture,
    rows,
    selectedScopes,
    viewMode,
    panoramaContext,
  ]);

  const displayMermaid = useMemo(() => {
    if (viewMode === "panorama") {
      return panoramaDiagram;
    }
    if (focusScope && diagramByScope[focusScope.id]) {
      return diagramByScope[focusScope.id];
    }
    return panoramaDiagram;
  }, [diagramByScope, focusScope, panoramaDiagram, viewMode]);

  useEffect(() => {
    if (!mermaidToExcalidrawLib.loaded) {
      return;
    }
    const mermaidCode = displayMermaid;
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
  }, [displayMermaid, mermaidToExcalidrawLib, theme]);

  const handleInsertToCanvas = useCallback(() => {
    if (panoramaDiagramStatus !== "ready") {
      setGenerationNotice("请先生成架构图后再插入画布。");
      return;
    }
    if (previewError || mermaidDataRef.current.elements.length === 0) {
      setGenerationNotice("预览异常，请重新生成后再插入。");
      return;
    }
    const mermaidText = displayMermaid;
    insertToEditor({
      app,
      data: mermaidDataRef,
      text: mermaidText,
      shouldSaveMermaidDataToStorage: true,
    });
    onInsertToCanvas();
  }, [
    app,
    displayMermaid,
    onInsertToCanvas,
    panoramaDiagramStatus,
    previewError,
  ]);

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

  const filteredViews = useMemo(
    () =>
      views.filter((view) => {
        const scopeId = scopeByGroupId[view.id];
        return Boolean(scopeId && selectedScopeIdSet.has(scopeId));
      }),
    [scopeByGroupId, selectedScopeIdSet, views],
  );

  const selectedRowIds = useMemo(
    () => new Set(selectedScopes.flatMap((scope) => scope.rowIds)),
    [selectedScopes],
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowIds.has(row.rowId)),
    [rows, selectedRowIds],
  );

  const totalPages = Math.max(1, Math.ceil(selectedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return selectedRows.slice(start, start + pageSize);
  }, [pageSize, safePage, selectedRows]);

  const activeLayerByRow = useMemo(() => {
    const map = new Map<number, string>();
    selectedScopeLayers.forEach((layer) => {
      layer.rowIds.forEach((rowId) => map.set(rowId, layer.name));
    });
    return map;
  }, [selectedScopeLayers]);

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
        width: 88,
        minWidth: 88,
        maxWidth: 88,
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
      { headerName: "rowId", field: "rowId", width: 86, minWidth: 86, maxWidth: 96 },
      { headerName: "主机名", field: "hostname", minWidth: 170, flex: 1 },
      { headerName: "内网IP", field: "privateIp", minWidth: 160, flex: 1 },
      { headerName: "服务名", field: "serviceName", minWidth: 180, flex: 1 },
      { headerName: "环境", field: "environment", minWidth: 120, flex: 1 },
      {
        headerName: "所属层",
        field: "rowId",
        minWidth: 160,
        valueGetter: (params) => activeLayerByRow.get(params.data?.rowId ?? -1) ?? "未分配",
      },
    ],
    [activeLayerByRow],
  );

  const statusText =
    panoramaDiagramStatus === "ready"
      ? "全景图已生成"
      : panoramaDiagramStatus === "generating"
        ? "全景图生成中"
        : draftStage === "layerReady"
          ? "主业务分层可编辑"
          : "未生成全景图";

  const relationshipCount = useMemo(() => {
    if (!displayMermaid) {
      return 0;
    }
    return (displayMermaid.match(/-->|---/g) ?? []).length;
  }, [displayMermaid]);

  const handlePrimaryAction = useCallback(() => {
    if (draftStage === "diagramReady") {
      handleInsertToCanvas();
      return;
    }
    void generatePanoramaDiagram();
  }, [draftStage, generatePanoramaDiagram, handleInsertToCanvas]);

  const primaryActionLabel = useMemo(() => {
    if (draftStage === "diagramReady") {
      return "确认插入画布";
    }
    return panoramaDiagramStatus === "generating" || isBusinessArchitectureStreaming
      ? "全景生成中..."
      : "生成全景架构图";
  }, [draftStage, isBusinessArchitectureStreaming, panoramaDiagramStatus]);

  const isPrimaryActionDisabled = useMemo(() => {
    if (selectedScopes.length === 0) {
      return true;
    }
    if (draftStage === "diagramReady") {
      return panoramaDiagramStatus !== "ready" || Boolean(previewError);
    }
    return isBusinessArchitectureStreaming || panoramaDiagramStatus === "generating";
  }, [
    draftStage,
    isBusinessArchitectureStreaming,
    panoramaDiagramStatus,
    previewError,
    selectedScopes.length,
  ]);

  return (
    <div className="ai-architecture-generation-dialog__step ai-architecture-generation-dialog__step--draft">
      <h3>草图生成与确认</h3>
      <div className="ai-architecture-generation-dialog__draft-status-bar">
        <div className="ai-architecture-generation-dialog__toolbar-group">
          <strong>当前视角：</strong>
          <span>{viewMode === "panorama" ? "全景视图" : "业务聚焦"}</span>
          <span className="ai-architecture-generation-dialog__summary">
            选中：{selectedScopes.length}/{businessScopes.length}
          </span>
          <span className="ai-architecture-generation-dialog__summary">资产数：{selectedRows.length}</span>
          <span className="ai-architecture-generation-dialog__summary">关系数：{relationshipCount}</span>
          <span className="ai-architecture-generation-dialog__summary">状态：{statusText}</span>
        </div>
        <div className="ai-architecture-generation-dialog__toolbar-group">
          <button
            type="button"
            className="ai-architecture-generation-dialog__btn-primary"
            onClick={handlePrimaryAction}
            disabled={isPrimaryActionDisabled}
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {generationNotice && <div className="ai-architecture-generation-dialog__success">{generationNotice}</div>}

      <div className="ai-architecture-generation-dialog__draft-main-grid">
        <section className="ai-architecture-generation-dialog__issue-card">
          <div className="ai-architecture-generation-dialog__inline-form">
            <strong>业务分区</strong>
            <div className="ai-architecture-generation-dialog__toolbar-group">
              <button
                type="button"
                onClick={() => onSelectedScopeIdsChange(businessScopes.map((scope) => scope.id))}
              >
                全选
              </button>
              <button type="button" onClick={() => onSelectedScopeIdsChange([])}>
                清空
              </button>
            </div>
            <button
              type="button"
              onClick={() => void refreshBusinessScopes()}
              disabled={isBusinessScopeStreaming}
            >
              {isBusinessScopeStreaming ? "识别中..." : "重识别业务分区"}
            </button>
          </div>

          <div className="ai-architecture-generation-dialog__issue-groups">
            {businessScopes.map((scope) => (
              <div key={scope.id} className="ai-architecture-generation-dialog__inline-form">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedScopeIdSet.has(scope.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? Array.from(new Set([...selectedScopeIds, scope.id]))
                        : selectedScopeIds.filter((id) => id !== scope.id);
                      onSelectedScopeIdsChange(next);
                      if (!next.includes(activeScopeId ?? "")) {
                        onActiveScopeIdChange(next[0] ?? null);
                      }
                    }}
                  />
                  {scope.name} ({scope.vmCount})
                </label>
                <button
                  type="button"
                  onClick={() => onActiveScopeIdChange(scope.id)}
                  disabled={activeScopeId === scope.id}
                >
                  设为主业务
                </button>
              </div>
            ))}
          </div>

          <div className="ai-architecture-generation-dialog__inline-form">
            <label>
              显示模式
              <select
                aria-label="显示模式"
                value={viewMode}
                onChange={(event) =>
                  onViewModeChange(event.target.value as "panorama" | "focus")
                }
              >
                <option value="panorama">全景视图</option>
                <option value="focus">业务聚焦</option>
              </select>
            </label>
          </div>

          <div className="ai-architecture-generation-dialog__inline-form">
            <input
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
              placeholder="按服务名筛选"
              aria-label="按服务名筛选"
            />
          </div>

          <details>
            <summary className="ai-architecture-generation-dialog__draft-source-toggle">
              服务命名建议（可选）
            </summary>
            <div className="ai-architecture-generation-dialog__issue-groups">
              {filteredViews.map((view) => {
                const group = groups.find((item) => item.id === view.id);
                if (!group) {
                  return null;
                }
                return (
                  <article key={view.id} className="ai-architecture-generation-dialog__issue-card">
                    <strong>{view.name}</strong>
                    <div className="ai-architecture-generation-dialog__summary">资产: {view.vmCount}</div>
                    <button type="button" onClick={() => void loadSuggestions(group)} disabled={isStreaming}>
                      AI命名建议
                    </button>
                    {(suggestions[group.id] ?? []).map((name) => (
                      <div key={`${group.id}:${name}`} className="ai-architecture-generation-dialog__inline-form">
                        <span>{name}</span>
                        <button type="button" onClick={() => applySuggestion(group, name)}>
                          应用
                        </button>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </details>

          <div className="ai-architecture-generation-dialog__inline-form">
            <button
              type="button"
              onClick={() => void requestScopeArchitecture()}
              disabled={!focusScope || isBusinessArchitectureStreaming}
            >
              {isBusinessArchitectureStreaming ? "分析中..." : "分析主业务分层"}
            </button>
            <button
              type="button"
              onClick={() => void generateDiagram()}
              disabled={!focusScope || selectedScopeDiagramStatus === "generating"}
            >
              {selectedScopeDiagramStatus === "generating" ? "生成中..." : "生成主业务分层图"}
            </button>
            <span className="ai-architecture-generation-dialog__summary">
              主业务：{focusScope?.name ?? "未选择"}
            </span>
          </div>

          <div className="ai-architecture-generation-dialog__layer-board">
            {selectedScopeLayers.map((layer, index) => (
              <article key={`${focusScope?.id ?? "none"}:${index}:${layer.name}`} className="ai-architecture-generation-dialog__layer-lane">
                <div className="ai-architecture-generation-dialog__layer-head">
                  <label>
                    层名称
                    <input
                      aria-label={`层名称-${index}`}
                      value={layer.name}
                      onChange={(event) => updateLayer(index, { name: event.target.value })}
                    />
                  </label>
                  <span className="ai-architecture-generation-dialog__summary">资产数: {layer.rowIds.length}</span>
                </div>
                <div className="ai-architecture-generation-dialog__summary">{layer.reason || layer.description}</div>
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
                    if (!Number.isFinite(dropped)) {
                      return;
                    }
                    assignRowToLayer(index, dropped);
                    setDragOverLayerIndex(null);
                    setDraggingRowId(null);
                  }}
                  data-drop-active={dragOverLayerIndex === index ? "true" : "false"}
                >
                  {layer.rowIds.length === 0 ? (
                    <span className="ai-architecture-generation-dialog__summary">拖入资产到该层</span>
                  ) : (
                    <div className="ai-architecture-generation-dialog__layer-assets">
                      {layer.rowIds.map((rowId) => (
                        <button
                          key={`${index}:${rowId}`}
                          type="button"
                          className="ai-architecture-generation-dialog__layer-asset-chip"
                          onClick={() => setActiveRowId(rowId)}
                        >
                          Row {rowId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label>
                  层资产 rowIds
                  <input
                    aria-label={`层资产-${index}`}
                    value={layer.rowIds.join(",")}
                    onChange={(event) => updateLayer(index, { rowIds: parseRowIdsInput(event.target.value) })}
                  />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-architecture-generation-dialog__issue-card">
          <strong>架构图预览</strong>
          {previewError && (
            <div className="ai-architecture-generation-dialog__error">
              预览失败: {previewError.message}
            </div>
          )}
          <div className="ai-architecture-generation-dialog__draft-preview-canvas">
            <div ref={canvasRef} />
          </div>
          <details>
            <summary className="ai-architecture-generation-dialog__draft-source-toggle">
              查看 Mermaid 源码
            </summary>
            <pre>{displayMermaid}</pre>
          </details>
        </section>
      </div>

      <div className="ai-architecture-generation-dialog__issue-card">
        <strong>资产表</strong>
        <div className="ai-architecture-generation-dialog__summary">
          当前选中业务资产: {selectedRows.length}
          {activeRowId !== null ? ` | 当前高亮 Row ${activeRowId}` : ""}
        </div>
        <div className="ai-architecture-generation-dialog__table-wrap">
          <SharedAgGrid<DraftGridRow>
            rowData={draftTableRows}
            columnDefs={draftTableColDefs}
            getRowId={(params) => String(params.data.rowId)}
            getRowClass={(params) =>
              params.data?.rowId === activeRowId
                ? "ai-architecture-generation-dialog__table-row-active"
                : undefined
            }
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
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1}>
            上一页
          </button>
          <span className="ai-architecture-generation-dialog__summary">
            第 {safePage}/{totalPages} 页
          </span>
          <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages}>
            下一页
          </button>
        </div>
      </div>

      <div className="ai-architecture-generation-dialog__actions">
        <button
          type="button"
          className="ai-architecture-generation-dialog__btn-ghost"
          onClick={onContinueCalibrate}
        >
          返回问题修复
        </button>
      </div>
    </div>
  );
};
