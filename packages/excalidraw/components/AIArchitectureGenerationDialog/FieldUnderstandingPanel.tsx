import React, { useMemo, useState } from "react";

import type {
  FieldInferenceResult,
  FieldMapping,
  StandardField,
} from "../AIArchitectureGeneration";

import { InferenceReasonBadge } from "./InferenceReasonBadge";

interface FieldUnderstandingPanelProps {
  fields: StandardField[];
  inferred: FieldInferenceResult;
  mapping: FieldMapping;
  headers: string[];
  editingField: StandardField | null;
  onStartEdit: (field: StandardField) => void;
  onChangeMapping: (field: StandardField, value: string) => void;
  onRequestAISuggestion: (field: StandardField) => void;
  aiSuggestingField: StandardField | null;
}

const getConfidenceLabel = (score: number | undefined) => {
  if (score === undefined) {
    return { text: "低把握", level: "low" as const };
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

const displayMappingValue = (field: StandardField, value: string | undefined) => {
  if (!value) {
    return "未识别";
  }
  if (field === "serviceName" && value === MANUAL_SERVICE_NAME_VALUE) {
    return "后续逐台补录";
  }
  return value;
};

export const FieldUnderstandingPanel: React.FC<FieldUnderstandingPanelProps> = ({
  fields,
  inferred,
  mapping,
  headers,
  editingField,
  onStartEdit,
  onChangeMapping,
  onRequestAISuggestion,
  aiSuggestingField,
}) => {
  const [showConfirmed, setShowConfirmed] = useState(false);
  const viewItems = useMemo(
    () =>
      fields.map((field) => {
        const top = inferred[field]?.[0];
        const confidence = getConfidenceLabel(top?.score);
        const isMapped = Boolean(mapping[field]);
        const canEdit = confidence.level === "low" || !isMapped;
        return {
          field,
          top,
          confidence,
          isMapped,
          canEdit,
        };
      }),
    [fields, inferred, mapping],
  );
  const uncertainItems = viewItems.filter((item) => item.canEdit);
  const confirmedItems = viewItems.filter((item) => !item.canEdit);

  const renderItem = (item: (typeof viewItems)[number]) => {
    const isEditing = editingField === item.field;
    return (
      <div
        key={item.field}
        className="ai-architecture-generation-dialog__mapping-row"
      >
        <div className="ai-architecture-generation-dialog__mapping-field">
          <span className="ai-architecture-generation-dialog__mapping-field-name">
            {fieldLabelMap[item.field]}
          </span>
          <span className="ai-architecture-generation-dialog__summary">
            {item.field}
          </span>
          <div className="ai-architecture-generation-dialog__inline-form">
            <em
              className={`ai-architecture-generation-dialog__confidence ai-architecture-generation-dialog__confidence--${item.confidence.level}`}
            >
              {item.confidence.text}
            </em>
            <InferenceReasonBadge
              reason={item.top?.reason ?? "no alias match"}
            />
          </div>
        </div>
        <div className="ai-architecture-generation-dialog__inline-form">
          <strong>{displayMappingValue(item.field, mapping[item.field])}</strong>
          {item.canEdit && !isEditing && (
            <>
              <button type="button" onClick={() => onStartEdit(item.field)}>
                选择列名
              </button>
              <button
                type="button"
                onClick={() => onRequestAISuggestion(item.field)}
                disabled={aiSuggestingField === item.field}
              >
                {aiSuggestingField === item.field
                  ? "AI 识别中..."
                  : "AI 建议列名"}
              </button>
            </>
          )}
          {item.canEdit && isEditing && (
            <select
              value={mapping[item.field] ?? ""}
              onChange={(event) =>
                onChangeMapping(item.field, event.target.value)
              }
            >
              <option value="">未映射</option>
              {item.field === "serviceName" && (
                <option value={MANUAL_SERVICE_NAME_VALUE}>无对应列，后续逐台补录</option>
              )}
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ai-architecture-generation-dialog__step">
      <div className="ai-architecture-generation-dialog__summary">
        仅需你确认 {uncertainItems.length} 项（低把握或未识别）。
      </div>
      <div className="ai-architecture-generation-dialog__mapping-list">
        {uncertainItems.map(renderItem)}
      </div>
      <div className="ai-architecture-generation-dialog__actions">
        <button type="button" onClick={() => setShowConfirmed((prev) => !prev)}>
          {showConfirmed
            ? `收起 AI 已确认字段 (${confirmedItems.length})`
            : `查看 AI 已确认字段 (${confirmedItems.length})`}
        </button>
      </div>
      {showConfirmed && (
        <div className="ai-architecture-generation-dialog__mapping-list">
          {confirmedItems.map(renderItem)}
        </div>
      )}
    </div>
  );
};


