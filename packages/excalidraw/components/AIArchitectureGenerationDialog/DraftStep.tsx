import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  editsAtom,
  normalizedVmRowsAtom,
  quickGenerateDiagram,
  serviceGroupsAtom,
} from "../AIArchitectureGeneration";
import type { ServiceGroup } from "../AIArchitectureGeneration";

import { useServiceNamingSuggestion } from "./hooks/useServiceNamingSuggestion";
import { projectBusinessScopes } from "./utils/businessScope";
import { projectDraftGroups } from "./utils/draftProjection";

interface DraftStepProps {
  onContinueCalibrate: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  suggestions: Record<string, string[]>;
  onSuggestionsChange: (value: Record<string, string[]>) => void;
}

export const DraftStep: React.FC<DraftStepProps> = ({
  onContinueCalibrate,
  filter,
  onFilterChange,
  suggestions,
  onSuggestionsChange,
}) => {
  const groups = useAtomValue(serviceGroupsAtom);
  const rows = useAtomValue(normalizedVmRowsAtom);
  const [edits, setEdits] = useAtom(editsAtom);
  const { requestSuggestions, isStreaming } = useServiceNamingSuggestion();

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
  const businessScopes = useMemo(
    () => projectBusinessScopes(groups, rows),
    [groups, rows],
  );
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [diagramByScope, setDiagramByScope] = useState<Record<string, string>>({});
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
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
  const selectedScopeSet = useMemo(() => new Set(selectedScopeIds), [selectedScopeIds]);
  const filteredViews = useMemo(
    () =>
      views.filter((view) => {
        if (selectedScopeSet.size === 0) {
          return false;
        }
        const scopeId = scopeByGroupId[view.id];
        return scopeId ? selectedScopeSet.has(scopeId) : false;
      }),
    [scopeByGroupId, selectedScopeSet, views],
  );
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);
  const selectedRowIds = useMemo(() => {
    if (selectedScopeSet.size === 0) {
      return new Set<number>();
    }
    return new Set(
      businessScopes
        .filter((scope) => selectedScopeSet.has(scope.id))
        .flatMap((scope) => scope.rowIds),
    );
  }, [businessScopes, selectedScopeSet]);
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

  useEffect(() => {
    if (businessScopes.length === 0) {
      setSelectedScopeIds([]);
      return;
    }
    setSelectedScopeIds((prev) => {
      const valid = prev.filter((id) => businessScopes.some((scope) => scope.id === id));
      if (valid.length > 0) {
        return valid;
      }
      return businessScopes.map((scope) => scope.id);
    });
  }, [businessScopes]);

  const toggleScope = useCallback((scopeId: string) => {
    setSelectedScopeIds((prev) =>
      prev.includes(scopeId)
        ? prev.filter((id) => id !== scopeId)
        : [...prev, scopeId],
    );
  }, []);

  const generateDiagramByScope = useCallback(async () => {
    if (selectedScopeIds.length === 0) {
      return;
    }
    setIsGeneratingDiagram(true);
    const nextDiagrams: Record<string, string> = {};
    for (const scopeId of selectedScopeIds) {
      const scope = businessScopes.find((item) => item.id === scopeId);
      if (!scope) {
        continue;
      }
      const scopeGroupIdSet = new Set(scope.groupIds);
      const scopeGroups = groups.filter((group) => scopeGroupIdSet.has(group.id));
      const scopeRowIdSet = new Set(scope.rowIds);
      const scopeRows = rows.filter((row) => scopeRowIdSet.has(row.rowId));
      const diagram = await quickGenerateDiagram(scopeGroups, scopeRows, "microservices");
      if (diagram) {
        nextDiagrams[scope.id] = diagram;
      }
    }
    setDiagramByScope(nextDiagrams);
    setIsGeneratingDiagram(false);
  }, [businessScopes, groups, rows, selectedScopeIds]);

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>Draft 预览</h3>
      <p>先确认业务范围，再按业务生成初步架构图。AI 命名建议仅作候选，需手动应用。</p>
      <div className="ai-architecture-generation-dialog__issue-card">
        <strong>业务范围确认</strong>
        <div className="ai-architecture-generation-dialog__summary">
          已识别业务范围: {businessScopes.length}
        </div>
        <div className="ai-architecture-generation-dialog__inline-form">
          <button
            type="button"
            onClick={() => setSelectedScopeIds(businessScopes.map((scope) => scope.id))}
          >
            全选
          </button>
          <button type="button" onClick={() => setSelectedScopeIds([])}>
            清空
          </button>
        </div>
        <div className="ai-architecture-generation-dialog__issue-groups">
          {businessScopes.map((scope) => (
            <label key={scope.id} className="ai-architecture-generation-dialog__issue-type-card">
              <input
                type="checkbox"
                checked={selectedScopeIds.includes(scope.id)}
                onChange={() => toggleScope(scope.id)}
              />{" "}
              {scope.name} ({scope.vmCount})
              <span className="ai-architecture-generation-dialog__summary">
                应用类型:{" "}
                {Object.entries(scope.appTypeStats)
                  .slice(0, 3)
                  .map(([type, count]) => `${type}:${count}`)
                  .join(" / ")}
              </span>
            </label>
          ))}
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

      <div className="ai-architecture-generation-dialog__table-wrap">
        <table className="ai-architecture-generation-dialog__table">
          <thead>
            <tr>
              <th>rowId</th>
              <th>hostname</th>
              <th>privateIp</th>
              <th>serviceName</th>
              <th>environment</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.rowId}>
                <td>{row.rowId}</td>
                <td>{row.vm.hostname}</td>
                <td>{row.vm.privateIp}</td>
                <td>{edits[row.rowId]?.serviceName ?? row.vm.serviceName}</td>
                <td>{row.vm.environment}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          onClick={generateDiagramByScope}
          disabled={isGeneratingDiagram || selectedScopeIds.length === 0}
        >
          {isGeneratingDiagram ? "生成中..." : "按业务生成架构图"}
        </button>
        <button type="button" onClick={onContinueCalibrate}>
          进入 Calibrate
        </button>
      </div>
      {Object.keys(diagramByScope).length > 0 && (
        <div className="ai-architecture-generation-dialog__issue-groups">
          {Object.entries(diagramByScope).map(([scopeId, diagram]) => {
            const scopeName =
              businessScopes.find((scope) => scope.id === scopeId)?.name ?? scopeId;
            return (
              <article
                key={scopeId}
                className="ai-architecture-generation-dialog__issue-card"
              >
                <strong>{scopeName} 架构图草稿</strong>
                <pre>{diagram}</pre>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

