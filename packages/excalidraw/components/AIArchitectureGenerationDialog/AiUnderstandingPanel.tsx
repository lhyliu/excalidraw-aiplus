import React, { useMemo, useState } from "react";

import { useAtomValue } from "../../editor-jotai";
import {
  buildInitialFieldMapping,
  inferFieldCandidates,
  importedCsvAtom,
  issuesAtom,
  normalizedVmRowsAtom,
  serviceGroupsAtom,
} from "../AIArchitectureGeneration";
import type { StandardField } from "../AIArchitectureGeneration";

const issueTitleMap: Record<string, string> = {
  missing_required: "关键信息缺失",
  unknown_environment: "环境标签待确认",
  invalid_ip: "网络地址格式异常",
  duplicate_hostname: "主机名重复",
  duplicate_ip: "IP 冲突",
  invalid_number: "配置数值异常",
};

export const AiUnderstandingPanel: React.FC = () => {
  const importedCsv = useAtomValue(importedCsvAtom);
  const rows = useAtomValue(normalizedVmRowsAtom);
  const groups = useAtomValue(serviceGroupsAtom);
  const issues = useAtomValue(issuesAtom);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const inferred = useMemo(
    () => inferFieldCandidates(importedCsv.headers),
    [importedCsv.headers],
  );
  const mapping = useMemo(() => buildInitialFieldMapping(inferred), [inferred]);

  const issueStats = useMemo(() => {
    return issues.reduce(
      (acc, issue) => {
        acc[issue.code] = (acc[issue.code] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [issues]);
  const issueTypeCount = Object.keys(issueStats).length;

  const confidenceStats = useMemo(() => {
    const fields: StandardField[] = [
      "hostname",
      "privateIp",
      "serviceName",
      "environment",
      "cpuCores",
      "memoryGb",
      "cluster",
      "region",
    ];
    const result = { high: 0, medium: 0, unknown: 0 };
    fields.forEach((field) => {
      const candidate = inferred[field]?.[0];
      if (!candidate || !mapping[field]) {
        result.unknown += 1;
        return;
      }
      if (candidate.score >= 0.9) {
        result.high += 1;
      } else if (candidate.score >= 0.7) {
        result.medium += 1;
      } else {
        result.unknown += 1;
      }
    });
    return result;
  }, [inferred, mapping]);

  const insights = useMemo(() => {
    const result: Array<{ id: string; text: string; evidence: Array<{ rowId: number; hostname: string; privateIp: string }> }> = [];

    const subnetSet = new Set<string>();
    const subnetEvidence: Array<{ rowId: number; hostname: string; privateIp: string }> = [];
    rows.forEach((row) => {
      const ip = row.vm.privateIp?.trim();
      const match = ip?.match(/^(\d+)\.(\d+)\.(\d+)\.\d+$/);
      if (match) {
        subnetSet.add(`${match[1]}.${match[2]}.${match[3]}.0/24`);
        subnetEvidence.push({
          rowId: row.rowId,
          hostname: row.vm.hostname,
          privateIp: row.vm.privateIp,
        });
      }
    });
    if (subnetSet.size > 0) {
      result.push({
        id: "subnet",
        text: `发现 ${subnetSet.size} 个明显网段，已自动形成子网线索。`,
        evidence: subnetEvidence.slice(0, 8),
      });
    }

    const windowsRows = rows.filter((row) =>
      /win|windows/i.test(
        `${row.vm.hostname} ${row.vm.serviceName} ${row.vm.cluster} ${row.vm.region}`,
      ),
    );
    const windowsCount = windowsRows.length;
    if (windowsCount > 0) {
      result.push({
        id: "windows",
        text: `检测到 win 关键词，已将 ${windowsCount} 台资产标记为 Windows 线索。`,
        evidence: windowsRows.slice(0, 8).map((row) => ({
          rowId: row.rowId,
          hostname: row.vm.hostname,
          privateIp: row.vm.privateIp,
        })),
      });
    }

    const missingIpRows = rows.filter((row) => !row.vm.privateIp?.trim());
    const missingIpCount = missingIpRows.length;
    if (missingIpCount > 0) {
      result.push({
        id: "missing-ip",
        text: `发现 ${missingIpCount} 台资产缺少内网 IP，可能是跳板机或录入不完整。`,
        evidence: missingIpRows.slice(0, 8).map((row) => ({
          rowId: row.rowId,
          hostname: row.vm.hostname,
          privateIp: row.vm.privateIp,
        })),
      });
    }

    if (result.length === 0) {
      result.push({
        id: "no-pattern",
        text: "已完成基础数据阅读，暂未发现明显异常模式。",
        evidence: [],
      });
    }

    return result;
  }, [rows]);

  return (
    <aside className="ai-architecture-generation-dialog__side-panel">
      <h4>AI 理解摘要</h4>
      <div className="ai-architecture-generation-dialog__next-tip">
        {rows.length === 0
          ? "先导入数据，AI 会自动读懂表格并生成初步架构图。"
          : issueTypeCount > 0
            ? `你现在只需确认 ${issueTypeCount} 类待确认项，即可生成可用草稿。`
            : "数据状态良好，可直接进入初步架构图预览。"}
      </div>
      <div className="ai-architecture-generation-dialog__summary">资产数量: {rows.length}</div>
      <div className="ai-architecture-generation-dialog__summary">
        推断服务数量: {groups.length}
      </div>
      <div className="ai-architecture-generation-dialog__summary">待确认项类型统计:</div>
      <div className="ai-architecture-generation-dialog__inline-form">
        {Object.entries(issueStats).length === 0 &&
          (rows.length === 0 && confidenceStats.unknown > 0 ? (
            <span>尚未形成可校准资产，请先确认关键列（主机名/内网IP/服务名称）</span>
          ) : (
            <span>无待确认项</span>
          ))}
        {Object.entries(issueStats).map(([type, count]) => (
          <span key={type}>
            {issueTitleMap[type] ?? type}: {count}
          </span>
        ))}
      </div>
      <div className="ai-architecture-generation-dialog__summary">字段识别把握度统计:</div>
      <div className="ai-architecture-generation-dialog__summary">
        高把握: {confidenceStats.high}
      </div>
      <div className="ai-architecture-generation-dialog__summary">
        中把握: {confidenceStats.medium}
      </div>
      <div className="ai-architecture-generation-dialog__summary">
        未识别: {confidenceStats.unknown}
      </div>
      <div className="ai-architecture-generation-dialog__summary">AI 洞察:</div>
      <div className="ai-architecture-generation-dialog__insights">
        {insights.map((insight, index) => (
          <div
            key={insight.id}
            className="ai-architecture-generation-dialog__insight-item"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="ai-architecture-generation-dialog__insight-check">
              ✓
            </span>
            <span>{insight.text}</span>
            {insight.evidence.length > 0 && (
              <button
                type="button"
                className="ai-architecture-generation-dialog__insight-evidence-btn"
                onClick={() =>
                  setExpandedInsightId((prev) =>
                    prev === insight.id ? null : insight.id,
                  )
                }
              >
                查看依据
              </button>
            )}
            {expandedInsightId === insight.id && insight.evidence.length > 0 && (
              <div className="ai-architecture-generation-dialog__insight-evidence">
                {insight.evidence.map((item) => (
                  <div key={`${insight.id}:${item.rowId}`}>
                    Row {item.rowId} | {item.hostname || "-"} | {item.privateIp || "-"}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};
