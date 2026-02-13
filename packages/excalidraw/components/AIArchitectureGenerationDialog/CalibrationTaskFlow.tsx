import React, { useEffect, useMemo, useState } from "react";

import type {
  CalibrationTask,
  Issue,
  ServiceGroup,
} from "../AIArchitectureGeneration";

interface IssueGroup {
  key: string;
  title: string;
  count: number;
  items: Issue[];
  severity: "error" | "warning";
  resolvedCount: number;
  skippedCount: number;
  analysis: string;
}

interface CalibrationTaskFlowProps {
  calibrationTasks: CalibrationTask[];
  issueGroups: IssueGroup[];
  activeIssueGroupKey: string | null;
  onChangeIssueGroup: (key: string) => void;
  lowConfidenceGroups: ServiceGroup[];
  draftValues: Record<string, string>;
  defaultValueForIssue: (issue: Issue) => string;
  onDraftChange: (issueId: string, value: string) => void;
  onApplyIssueFix: (issue: Issue) => void;
  onApplyGroupFix: (group: IssueGroup) => void;
  getBatchApplicableCount: (group: IssueGroup) => number;
  rowContextById: Record<
    number,
    { hostname: string; privateIp: string; serviceName: string }
  >;
  onRequestAISuggestion: (group: IssueGroup) => void;
  isAISuggesting: boolean;
  aiSuggestionNote: string | null;
  groupDraftValues: Record<string, string>;
  onChangeGroupDraftValue: (groupKey: string, value: string) => void;
  skipReasons: Record<string, string>;
  onChangeSkipReason: (issueId: string, reason: string) => void;
  onSkipIssue: (issue: Issue, reason: string) => void;
}

type FlowTaskType = "service-grouping" | "service-semantics";

interface FlowTask {
  id: FlowTaskType;
  title: string;
  description: string;
}

const ENV_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "production", label: "生产（production）" },
  { value: "staging", label: "预发（staging）" },
  { value: "testing", label: "测试（testing）" },
  { value: "development", label: "开发（development）" },
];

export const CalibrationTaskFlow: React.FC<CalibrationTaskFlowProps> = ({
  calibrationTasks,
  issueGroups,
  activeIssueGroupKey,
  onChangeIssueGroup,
  lowConfidenceGroups,
  draftValues,
  defaultValueForIssue,
  onDraftChange,
  onApplyIssueFix,
  onApplyGroupFix,
  getBatchApplicableCount,
  rowContextById,
  onRequestAISuggestion,
  isAISuggesting,
  aiSuggestionNote,
  groupDraftValues,
  onChangeGroupDraftValue,
  skipReasons,
  onChangeSkipReason,
  onSkipIssue,
}) => {
  const flowTasks = useMemo(() => {
    const tasks: FlowTask[] = [];
    const hasGroupingTask = calibrationTasks.some(
      (task) => task.type === "confirm_group",
    );
    if (hasGroupingTask) {
      tasks.push({
        id: "service-grouping",
        title: "服务分组待确认",
        description: "确认低把握度分组，避免错误分组进入架构草稿。",
      });
    }
    tasks.push({
      id: "service-semantics",
      title: "机器用途待确认",
      description: "按待确认项补齐字段并确认机器用途。",
    });
    return tasks;
  }, [calibrationTasks]);

  const [activeTaskId, setActiveTaskId] = useState<FlowTaskType>(flowTasks[0].id);

  useEffect(() => {
    if (!flowTasks.some((task) => task.id === activeTaskId)) {
      setActiveTaskId(flowTasks[0].id);
    }
  }, [activeTaskId, flowTasks]);

  const activeTaskIndex = flowTasks.findIndex((task) => task.id === activeTaskId);
  const currentTask = flowTasks[activeTaskIndex] ?? flowTasks[0];
  const currentGroup =
    issueGroups.find((group) => group.key === activeIssueGroupKey) ?? issueGroups[0];
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const isEnvironmentGroup = Boolean(
    currentGroup &&
      currentGroup.items.length > 0 &&
      currentGroup.items.every(
        (issue) => issue.code === "unknown_environment" && issue.field === "environment",
      ),
  );
  const groupDefaultValue =
    currentGroup && currentGroup.items[0]
      ? defaultValueForIssue(currentGroup.items[0])
      : "";
  const groupDraftValue = currentGroup
    ? groupDraftValues[currentGroup.key] ?? groupDefaultValue
    : "";
  const sampleContext = currentGroup?.items[0]
    ? rowContextById[currentGroup.items[0].rowId]
    : undefined;

  return (
    <section className="ai-architecture-generation-dialog__task-flow">
      <div className="ai-architecture-generation-dialog__task-flow-head">
        <h4>当前校准任务</h4>
        <span className="ai-architecture-generation-dialog__summary">
          {Math.max(activeTaskIndex + 1, 1)}/{flowTasks.length}
        </span>
      </div>
      <div className="ai-architecture-generation-dialog__inline-form">
        {flowTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`ai-architecture-generation-dialog__issue-type-card${
              task.id === currentTask.id ? " is-active" : ""
            }`}
            onClick={() => setActiveTaskId(task.id)}
          >
            {task.title}
          </button>
        ))}
      </div>
      <article className="ai-architecture-generation-dialog__issue-card">
        <strong>{currentTask.title}</strong>
        <div>{currentTask.description}</div>
      </article>

      {currentTask.id === "service-grouping" && (
        <div className="ai-architecture-generation-dialog__issue-groups">
          {lowConfidenceGroups.length === 0 && (
            <div className="ai-architecture-generation-dialog__success">
              当前无低置信分组。
            </div>
          )}
          {lowConfidenceGroups.map((group) => (
            <article
              key={group.id}
              className="ai-architecture-generation-dialog__issue-card"
            >
              <strong>{group.name}</strong>
              <div>资产数量: {group.rowIds.length}</div>
              <div>把握度: {group.confidence.toFixed(2)}</div>
              <div>推断依据: {group.reason}</div>
            </article>
          ))}
        </div>
      )}

      {currentTask.id === "service-semantics" && (
        <>
          <div className="ai-architecture-generation-dialog__issue-groups">
          {issueGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                className={`ai-architecture-generation-dialog__issue-type-card${
                  currentGroup?.key === group.key ? " is-active" : ""
                }`}
                onClick={() => onChangeIssueGroup(group.key)}
              >
                {group.title} ({group.count})
              </button>
            ))}
          </div>
          {currentGroup && (
            <section>
              <article className="ai-architecture-generation-dialog__issue-card">
                <div className="ai-architecture-generation-dialog__inline-form">
                  <strong>{currentGroup.severity === "error" ? "高优先级" : "低优先级"}</strong>
                  <span>
                    {currentGroup.title} ({currentGroup.count} 项)
                  </span>
                  <span className="ai-architecture-generation-dialog__summary">
                    已处理 {currentGroup.resolvedCount + currentGroup.skippedCount}/
                    {currentGroup.count}
                  </span>
                </div>
                <div>AI 分析：{currentGroup.analysis}</div>
                {sampleContext && (
                  <div className="ai-architecture-generation-dialog__summary">
                    示例设备: {sampleContext.hostname || "-"} / {sampleContext.privateIp || "-"}
                  </div>
                )}
                <div className="ai-architecture-generation-dialog__inline-form">
                  {isEnvironmentGroup ? (
                    <select
                      value={groupDraftValue}
                      onChange={(event) =>
                        onChangeGroupDraftValue(currentGroup.key, event.target.value)
                      }
                      aria-label="环境建议值"
                    >
                      <option value="">请选择环境</option>
                      {ENV_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={groupDraftValue}
                      onChange={(event) =>
                        onChangeGroupDraftValue(currentGroup.key, event.target.value)
                      }
                      placeholder="建议值（可改）"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onApplyGroupFix(currentGroup)}
                    disabled={getBatchApplicableCount(currentGroup) === 0}
                  >
                    确认并应用 ({getBatchApplicableCount(currentGroup)})
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestAISuggestion(currentGroup)}
                    disabled={isAISuggesting}
                  >
                    {isAISuggesting ? "AI 建议生成中..." : "AI 生成建议"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroupKey((prev) =>
                        prev === currentGroup.key ? null : currentGroup.key,
                      )
                    }
                  >
                    {expandedGroupKey === currentGroup.key
                      ? "收起样本"
                      : "预览涉及的主机"}
                  </button>
                </div>
                {isEnvironmentGroup && (
                  <div className="ai-architecture-generation-dialog__summary">
                    将按标准环境值写入：{groupDraftValue || "production"}
                  </div>
                )}
                {aiSuggestionNote && (
                  <div className="ai-architecture-generation-dialog__summary">
                    AI 建议说明: {aiSuggestionNote}
                  </div>
                )}
                {getBatchApplicableCount(currentGroup) === 0 && (
                  <div className="ai-architecture-generation-dialog__summary">
                    当前分组暂无可靠批量建议，请展开样本逐条处理或使用批量编辑工具。
                  </div>
                )}
              </article>
              {expandedGroupKey === currentGroup.key && (
                <div className="ai-architecture-generation-dialog__issue-groups">
                  {currentGroup.items.slice(0, 8).map((issue) => (
                    <article
                      key={issue.id}
                      className="ai-architecture-generation-dialog__issue-card"
                    >
                      <div>
                        Row {issue.rowId}: {issue.message}
                      </div>
                      {rowContextById[issue.rowId] && (
                        <div className="ai-architecture-generation-dialog__summary">
                          设备: {rowContextById[issue.rowId].hostname || "-"} /{" "}
                          {rowContextById[issue.rowId].privateIp || "-"}
                        </div>
                      )}
                      {issue.field && (
                        <div className="ai-architecture-generation-dialog__inline-form">
                          <input
                            value={draftValues[issue.id] ?? defaultValueForIssue(issue)}
                            onChange={(event) =>
                              onDraftChange(issue.id, event.target.value)
                            }
                            placeholder="修正值"
                          />
                          <button type="button" onClick={() => onApplyIssueFix(issue)}>
                            应用
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onSkipIssue(
                                issue,
                                skipReasons[issue.id] || "已人工确认可暂时跳过",
                              )
                            }
                          >
                            忽略
                          </button>
                        </div>
                      )}
                      <div className="ai-architecture-generation-dialog__inline-form">
                        <input
                          value={skipReasons[issue.id] ?? ""}
                          onChange={(event) =>
                            onChangeSkipReason(issue.id, event.target.value)
                          }
                          placeholder="忽略原因（可选）"
                        />
                      </div>
                    </article>
                  ))}
                  {currentGroup.items.length > 8 && (
                    <div className="ai-architecture-generation-dialog__summary">
                      仅展示前 8 条样本，可使用批量编辑工具处理全部数据。
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
};


