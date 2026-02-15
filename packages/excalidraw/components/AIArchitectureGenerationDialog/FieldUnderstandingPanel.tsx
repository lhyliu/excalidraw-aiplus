import React, { useMemo } from "react";

import type {
  FieldInferenceResult,
  FieldMapping,
  StandardField,
} from "../AIArchitectureGeneration";

import { InferenceReasonBadge } from "./InferenceReasonBadge";

interface FieldUnderstandingPanelProps {
  sectionTitle: string;
  sectionIcon: string;
  fields: StandardField[];
  inferred: FieldInferenceResult;
  mapping: FieldMapping;
  headers: string[];
  sampleRow?: Record<string, string>;
  onChangeMapping: (field: StandardField, value: string) => void;
  onRequestAISuggestion: (field: StandardField) => void;
  aiSuggestingField: StandardField | null;
  defaultExpanded?: boolean;
}

const getConfidenceLabel = (score: number | undefined) => {
  if (score === undefined) {
    return { text: "未识别", level: "low" as const };
  }
  if (score >= 0.9) {
    return { text: "高把握", level: "high" as const };
  }
  if (score >= 0.7) {
    return { text: "中把握", level: "medium" as const };
  }
  return { text: "低把握", level: "low" as const };
};

const fieldLabelMap: Record<StandardField, string> = {
  hostname: "主机名",
  privateIp: "内网 IP",
  serviceName: "机器用途",
  environment: "部署环境",
  cpuCores: "CPU 核数",
  memoryGb: "内存(GB)",
  cluster: "集群",
  region: "地域",
};

const MANUAL_SERVICE_NAME_VALUE = "__manual__serviceName";

export const FieldUnderstandingPanel: React.FC<FieldUnderstandingPanelProps> = ({
  sectionTitle,
  sectionIcon,
  fields,
  inferred,
  mapping,
  headers,
  sampleRow,
  onChangeMapping,
  onRequestAISuggestion,
  aiSuggestingField,
}) => {
  const viewItems = useMemo(
    () =>
      fields.map((field) => {
        const top = inferred[field]?.[0];
        const confidence = getConfidenceLabel(top?.score);
        const isMapped = Boolean(mapping[field]);
        const mappedHeader = mapping[field];
        const sampleValue = mappedHeader && sampleRow ? sampleRow[mappedHeader] : undefined;
        return {
          field,
          top,
          confidence,
          isMapped,
          mappedHeader,
          sampleValue,
        };
      }),
    [fields, inferred, mapping, sampleRow],
  );

  return (
    <div className="ai-architecture-generation-dialog__field-section">
      <div className="ai-architecture-generation-dialog__field-section-header">
        <span>{sectionIcon}</span>
        <span className="ai-architecture-generation-dialog__field-section-title">
          {sectionTitle}
        </span>
        <span className="ai-architecture-generation-dialog__summary">
          仅需你确认 {viewItems.filter((i) => !i.isMapped || i.confidence.level === "low").length} 项
        </span>
      </div>
      <div className="ai-architecture-generation-dialog__mapping-list">
        {viewItems.map((item) => (
          <div
            key={item.field}
            className={`ai-architecture-generation-dialog__mapping-row${item.isMapped ? " is-mapped" : " is-unmapped"
              }`}
          >
            {/* Left: Field info */}
            <div className="ai-architecture-generation-dialog__mapping-field">
              <span className="ai-architecture-generation-dialog__mapping-status">
                {item.isMapped ? "✅" : "⚠️"}
              </span>
              <div className="ai-architecture-generation-dialog__mapping-field-info">
                <span className="ai-architecture-generation-dialog__mapping-field-name">
                  {fieldLabelMap[item.field]}
                </span>
                <span className="ai-architecture-generation-dialog__mapping-field-key">
                  {item.field}
                </span>
              </div>
              <span
                className={`ai-architecture-generation-dialog__confidence ai-architecture-generation-dialog__confidence--${item.confidence.level}`}
              >
                {item.confidence.text}
              </span>
              <InferenceReasonBadge reason={item.top?.reason ?? "no alias match"} />
            </div>

            {/* Center: Arrow */}
            <span className="ai-architecture-generation-dialog__mapping-arrow">→</span>

            {/* Right: Mapping select + actions */}
            <div className="ai-architecture-generation-dialog__mapping-value">
              <select
                className="ai-architecture-generation-dialog__mapping-select"
                value={mapping[item.field] ?? ""}
                onChange={(event) =>
                  onChangeMapping(item.field, event.target.value)
                }
              >
                <option value="">— 选择列名 —</option>
                {item.field === "serviceName" && (
                  <option value={MANUAL_SERVICE_NAME_VALUE}>无对应列，后续逐台补录</option>
                )}
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              {item.sampleValue !== undefined && (
                <span
                  className="ai-architecture-generation-dialog__mapping-sample"
                  title={`示例值: ${item.sampleValue}`}
                >
                  例: {item.sampleValue || "-"}
                </span>
              )}
              {item.confidence.level === "low" && (
                <button
                  type="button"
                  className="ai-architecture-generation-dialog__table-ai-btn"
                  onClick={() => onRequestAISuggestion(item.field)}
                  disabled={aiSuggestingField === item.field}
                >
                  {aiSuggestingField === item.field ? "识别中..." : "🤖 AI建议"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



