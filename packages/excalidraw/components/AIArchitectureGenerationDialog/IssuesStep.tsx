import React, { useCallback, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  buildCalibrationTasks,
  editsAtom,
  issuesAtom,
  normalizedVmRowsAtom,
  serviceGroupsAtom,
} from "../AIArchitectureGeneration";
import type { Issue } from "../AIArchitectureGeneration";

import { CalibrationTaskFlow } from "./CalibrationTaskFlow";
import { useIssueSuggestion } from "./hooks/useIssueSuggestion";

interface IssuesStepProps {
  onOpenExpert: () => void;
  onContinueDraft: () => void;
}

const getIssueGroupKey = (issue: Issue): string => `${issue.code}:${issue.field ?? "_"}`;
const getIssueGroupTitle = (issue: Issue): string => {
  if (issue.code === "missing_required" && issue.field === "hostname") {
    return "主机名缺失";
  }
  if (issue.code === "missing_required" && issue.field === "privateIp") {
    return "内网 IP 缺失";
  }
  if (issue.code === "missing_required" && issue.field === "serviceName") {
    return "服务名称缺失";
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
  if (issue.code === "invalid_number") {
    return "数值格式异常";
  }
  return "待确认数据";
};

const defaultSuggestionForIssue = (issue: Issue): string => {
  return issue.suggestedValue ?? "";
};

const getGroupAnalysis = (issue: Issue, count: number): string => {
  if (issue.code === "unknown_environment") {
    return `检测到 ${count} 台资产缺少标准环境标签。可先批量设为 production，再按业务拆分。`;
  }
  if (issue.code === "missing_required" && issue.field === "privateIp") {
    return `检测到 ${count} 条资产缺少内网 IP，建议补齐后再生成网络关系。`;
  }
  if (issue.code === "missing_required" && issue.field === "hostname") {
    return `检测到 ${count} 条资产缺少主机名，建议先补全可识别名称。`;
  }
  if (issue.code === "missing_required" && issue.field === "serviceName") {
    return `检测到 ${count} 台资产缺少服务名称。请按设备补录组件用途，支持批量确认。`;
  }
  if (issue.code === "invalid_ip") {
    return `检测到 ${count} 条 IP 格式异常。建议优先修正，避免网络拓扑误判。`;
  }
  if (issue.code === "invalid_number") {
    return `检测到 ${count} 条数值格式异常，建议统一为可解析数字。`;
  }
  return `检测到 ${count} 条待确认数据，请确认后继续生成草稿。`;
};

export const IssuesStep: React.FC<IssuesStepProps> = ({
  onOpenExpert,
  onContinueDraft,
}) => {
  const issues = useAtomValue(issuesAtom);
  const normalizedRows = useAtomValue(normalizedVmRowsAtom);
  const serviceGroups = useAtomValue(serviceGroupsAtom);
  const [edits, setEdits] = useAtom(editsAtom);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [groupDraftValues, setGroupDraftValues] = useState<Record<string, string>>({});
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [aiSuggestionNote, setAiSuggestionNote] = useState<string | null>(null);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const { requestSuggestion, isStreaming: isAISuggesting } = useIssueSuggestion();

  const groupedByType = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        count: number;
        items: Issue[];
        severity: "error" | "warning";
        resolvedCount: number;
        skippedCount: number;
        analysis: string;
      }
    >();
    issues.forEach((issue) => {
      const key = getIssueGroupKey(issue);
      const current = groups.get(key);
      if (!current) {
        groups.set(key, {
          key,
          title: getIssueGroupTitle(issue),
          count: 1,
          items: [issue],
          severity: issue.severity,
          resolvedCount: 0,
          skippedCount: 0,
          analysis: getGroupAnalysis(issue, 1),
        });
        return;
      }
      current.count += 1;
      current.items.push(issue);
      if (issue.severity === "error") {
        current.severity = "error";
      }
      current.analysis = getGroupAnalysis(issue, current.count);
    });
    groups.forEach((group) => {
      group.items.forEach((issue) => {
        const resolved =
          !!issue.field &&
          (edits[issue.rowId]?.[issue.field] ?? "").toString().trim().length > 0;
        if (resolved) {
          group.resolvedCount += 1;
        }
        if (skipReasons[issue.id]) {
          group.skippedCount += 1;
        }
      });
    });
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [edits, issues, skipReasons]);
  const currentGroup = groupedByType.find((g) => g.key === activeGroupKey) ?? groupedByType[0];
  const calibrationTasks = useMemo(
    () => buildCalibrationTasks(issues, serviceGroups),
    [issues, serviceGroups],
  );
  const lowConfidenceGroupIds = useMemo(
    () =>
      new Set(
        calibrationTasks
          .filter((task) => task.type === "confirm_group" && task.groupId)
          .map((task) => task.groupId as string),
      ),
    [calibrationTasks],
  );
  const lowConfidenceGroups = useMemo(
    () => serviceGroups.filter((group) => lowConfidenceGroupIds.has(group.id)),
    [lowConfidenceGroupIds, serviceGroups],
  );
  const rowContextById = useMemo(
    () =>
      normalizedRows.reduce(
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
          { hostname: string; privateIp: string; serviceName: string }
        >,
      ),
    [normalizedRows],
  );

  const applyFix = useCallback(
    (issue: Issue) => {
      if (!issue.field) {
        return;
      }
      const key = issue.id;
      const value =
        draftValues[key] ?? issue.suggestedValue ?? defaultSuggestionForIssue(issue);
      setEdits((prev) => ({
        ...prev,
        [issue.rowId]: {
          ...(prev[issue.rowId] ?? {}),
          [issue.field!]: value,
        },
      }));
      setNotice(`已应用修正: row ${issue.rowId} / ${issue.field}`);
    },
    [draftValues, setEdits],
  );

  const getIssueSuggestion = useCallback(
    (issue: Issue) =>
      (issue.suggestedValue ?? draftValues[issue.id] ?? defaultSuggestionForIssue(issue)).trim(),
    [draftValues],
  );

  const getBatchApplicableCount = useCallback(
    (group: (typeof groupedByType)[number]) => {
      const manualValue = (groupDraftValues[group.key] ?? "").trim();
      if (manualValue.length > 0) {
        return group.items.filter((issue) => issue.field).length;
      }
      return group.items.filter((issue) => issue.field && getIssueSuggestion(issue).length > 0)
        .length;
    },
    [getIssueSuggestion, groupDraftValues],
  );

  const applyGroupFix = useCallback(
    (group: (typeof groupedByType)[number]) => {
      const manualValue = (groupDraftValues[group.key] ?? "").trim();
      const targetItems = group.items
        .filter((issue) => issue.field)
        .map((issue) => ({
          rowId: issue.rowId,
          field: issue.field as NonNullable<Issue["field"]>,
          value: manualValue || getIssueSuggestion(issue),
        }))
        .filter((item) => item.value.length > 0);
      const appliedCount = targetItems.length;
      setEdits((prev) => {
        const next = { ...prev };
        targetItems.forEach((item) => {
          next[item.rowId] = {
            ...(next[item.rowId] ?? {}),
            [item.field]: item.value,
          };
        });
        return next;
      });
      setNotice(
        appliedCount > 0
          ? `已批量应用: ${group.title} (${appliedCount} 项)`
          : `当前分组缺少可自动应用的建议，请切换专家模式处理。`,
      );
    },
    [getIssueSuggestion, groupDraftValues, setEdits],
  );

  const setDraft = useCallback((issueId: string, value: string) => {
    setDraftValues((prev) => ({
      ...prev,
      [issueId]: value,
    }));
  }, []);

  const setSkipReason = useCallback((issueId: string, reason: string) => {
    setSkipReasons((prev) => ({
      ...prev,
      [issueId]: reason,
    }));
  }, []);

  const skipIssue = useCallback((issue: Issue, reason: string) => {
    setSkipReasons((prev) => ({
      ...prev,
      [issue.id]: reason.trim() || "已人工确认可暂时跳过",
    }));
    setNotice(`已跳过待确认项: row ${issue.rowId}`);
  }, []);

  const requestGroupAISuggestion = useCallback(
    async (group: (typeof groupedByType)[number]) => {
      setAiSuggestionNote(null);
      const suggestion = await requestSuggestion(
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
        setNotice("未生成到可靠 AI 建议，请手动输入或切换专家模式。");
        return;
      }
      setGroupDraftValues((prev) => ({
        ...prev,
        [group.key]: suggestion.suggestedValue,
      }));
      setAiSuggestionNote(suggestion.reason || "基于样本资产推断");
      setNotice(`AI 已生成建议值: ${suggestion.suggestedValue}`);
    },
    [groupedByType, requestSuggestion, rowContextById],
  );

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>待确认事项（{groupedByType.length} 类）</h3>
      <p>优先按类型批量确认；仅在必要时再进入表格模式精修。</p>
      <section className="ai-architecture-generation-dialog__mode-hints">
        <article className="ai-architecture-generation-dialog__mode-card is-safe">
          <strong>模式切换：向导模式</strong>
          <div>适合快速确认，系统按问题类型给出批量建议。</div>
        </article>
        <article className="ai-architecture-generation-dialog__mode-card is-expert">
          <strong>模式切换：表格模式</strong>
          <div>适合批量编辑复杂数据，支持批量填充与多行忽略。</div>
          <button type="button" onClick={onOpenExpert}>
            打开专家模式（批量编辑）
          </button>
        </article>
      </section>
      {groupedByType.length === 0 && (
        <div className="ai-architecture-generation-dialog__success">
          当前没有待确认项，可直接进入 Draft 预览。
        </div>
      )}
      <div className="ai-architecture-generation-dialog__actions">
        <button
          type="button"
          className="ai-architecture-generation-dialog__draft-entry"
          onClick={onContinueDraft}
        >
          进入 Draft 预览（AI 自动补全剩余信息）
        </button>
      </div>
      {notice && (
        <div className="ai-architecture-generation-dialog__success">{notice}</div>
      )}
      <CalibrationTaskFlow
        calibrationTasks={calibrationTasks}
        issueGroups={groupedByType}
        activeIssueGroupKey={activeGroupKey}
        onChangeIssueGroup={setActiveGroupKey}
        lowConfidenceGroups={lowConfidenceGroups}
        draftValues={draftValues}
        defaultValueForIssue={defaultSuggestionForIssue}
        onDraftChange={setDraft}
        onApplyIssueFix={applyFix}
        onApplyGroupFix={applyGroupFix}
        getBatchApplicableCount={getBatchApplicableCount}
        rowContextById={rowContextById}
        onRequestAISuggestion={requestGroupAISuggestion}
        isAISuggesting={isAISuggesting}
        aiSuggestionNote={aiSuggestionNote}
        groupDraftValues={groupDraftValues}
        onChangeGroupDraftValue={(groupKey, value) =>
          setGroupDraftValues((prev) => ({
            ...prev,
            [groupKey]: value,
          }))
        }
        skipReasons={skipReasons}
        onChangeSkipReason={setSkipReason}
        onSkipIssue={skipIssue}
      />
      <div className="ai-architecture-generation-dialog__summary">
        当前 edits 条目: {Object.keys(edits).length}
      </div>
    </div>
  );
};

