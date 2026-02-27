import React, { useCallback, useMemo, useState } from "react";

import { useAtom, useAtomValue } from "../../editor-jotai";
import {
  buildInitialFieldMapping,
  fieldMappingAtom,
  importedCsvAtom,
  inferFieldCandidates,
  validateFieldMapping,
} from "../AIArchitectureGeneration";
import type { StandardField } from "../AIArchitectureGeneration";

import { FieldUnderstandingPanel } from "./FieldUnderstandingPanel";
import { useAliasMemory } from "./hooks/useAliasMemory";
import { useFieldMappingSuggestion } from "./hooks/useFieldMappingSuggestion";

interface FieldMappingStepProps {
  onContinue: () => void;
  onGenerateDraft: () => void;
  readOnly?: boolean;
}

const requiredFields: StandardField[] = ["hostname", "privateIp", "serviceName"];
const orderedFields: StandardField[] = [
  "hostname",
  "privateIp",
  "serviceName",
  "environment",
  "cpuCores",
  "memoryGb",
  "cluster",
  "region",
];

export const FieldMappingStep: React.FC<FieldMappingStepProps> = ({
  onContinue,
  onGenerateDraft,
  readOnly = false,
}) => {
  const importedCsv = useAtomValue(importedCsvAtom);
  const [mapping, setMapping] = useAtom(fieldMappingAtom);
  const [error, setError] = useState<string | null>(null);
  const { rememberMapping } = useAliasMemory();
  const [notice, setNotice] = useState<string | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [aiSuggestingField, setAiSuggestingField] = useState<StandardField | null>(
    null,
  );
  const { requestSuggestion } = useFieldMappingSuggestion();

  const inferred = useMemo(
    () => inferFieldCandidates(importedCsv.headers),
    [importedCsv.headers],
  );

  const effectiveMapping = useMemo(() => {
    const suggested = buildInitialFieldMapping(inferred);
    return {
      ...suggested,
      ...mapping,
    };
  }, [mapping, inferred]);

  const handleChange = useCallback(
    (field: StandardField, value: string) => {
      if (readOnly) {
        return;
      }
      setMapping((prev) => ({
        ...prev,
        [field]: value || undefined,
      }));
      setNotice(null);
    },
    [readOnly, setMapping],
  );

  const handleApply = useCallback(() => {
    if (readOnly) {
      return;
    }
    const validation = validateFieldMapping(effectiveMapping);
    if (!validation.ok) {
      setError(`缺少必填映射: ${validation.missingRequiredFields.join(", ")}`);
      setNotice(null);
      return;
    }
    setMapping(effectiveMapping);
    rememberMapping(effectiveMapping);
    setError(null);
    setNotice("AI 理解已确认，并已写入字段别名记忆。");
    onContinue();
  }, [effectiveMapping, onContinue, readOnly, rememberMapping, setMapping]);

  const handleRequestAISuggestion = useCallback(
    async (field: StandardField) => {
      if (readOnly) {
        return;
      }
      setAiSuggestingField(field);
      setNotice(null);
      const sampleRows = importedCsv.rows.map((row) => row.raw);
      const suggestion = await requestSuggestion(field, importedCsv.headers, sampleRows);
      setAiSuggestingField(null);
      if (!suggestion) {
        setNotice("AI 未能给出可靠列名建议，请手动选择。");
        return;
      }
      if (!importedCsv.headers.includes(suggestion.header)) {
        setNotice("AI 建议未命中当前列名，请手动确认。");
        return;
      }
      setMapping((prev) => ({
        ...prev,
        [field]: suggestion.header,
      }));
      setNotice(
        suggestion.reason
          ? `AI 建议: ${field} ← ${suggestion.header}（${suggestion.reason}）`
          : `AI 建议: ${field} ← ${suggestion.header}`,
      );
    },
    [importedCsv.headers, importedCsv.rows, readOnly, requestSuggestion, setMapping],
  );

  const requiredMappedCount = requiredFields.filter(
    (field) => effectiveMapping[field],
  ).length;
  const optionalFields = orderedFields.filter(
    (field) => !requiredFields.includes(field),
  );
  const optionalMappedCount = optionalFields.filter(
    (field) => effectiveMapping[field],
  ).length;
  const allRequiredMapped = requiredMappedCount === requiredFields.length;
  const progressPercent = Math.round(
    (requiredMappedCount / requiredFields.length) * 100,
  );

  if (importedCsv.headers.length === 0) {
    return (
      <div className="ai-architecture-generation-dialog__step">
        <h3>字段确认</h3>
        <p>请先完成 CSV 导入。</p>
      </div>
    );
  }

  return (
    <div className="ai-architecture-generation-dialog__step ai-architecture-generation-dialog__step--field-mapping">
      {/* Header with title and action buttons */}
      <div className="ai-architecture-generation-dialog__field-mapping-header">
        <h3>字段确认</h3>
        <div className="ai-architecture-generation-dialog__import-actions-inline">
          <button
            type="button"
            className="ai-architecture-generation-dialog__btn-primary"
            onClick={handleApply}
            disabled={readOnly}
          >
            确认并进入问题修复
          </button>
          <button
            type="button"
            className="ai-architecture-generation-dialog__btn-secondary"
            onClick={onGenerateDraft}
            disabled={readOnly}
          >
            直接进入草图确认
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="ai-architecture-generation-dialog__field-progress">
        <div className="ai-architecture-generation-dialog__field-progress-header">
          <span className="ai-architecture-generation-dialog__summary">
            画图必需字段覆盖: {requiredMappedCount}/{requiredFields.length}
          </span>
          {allRequiredMapped ? (
            <span className="ai-architecture-generation-dialog__field-progress-badge ai-architecture-generation-dialog__field-progress-badge--done">
              ✓ 必填已就绪
            </span>
          ) : (
            <span className="ai-architecture-generation-dialog__field-progress-badge">
              请确认下方字段映射
            </span>
          )}
        </div>
        <div className="ai-architecture-generation-dialog__field-progress-bar">
          <div
            className={`ai-architecture-generation-dialog__field-progress-fill${allRequiredMapped ? " is-complete" : ""}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Guidance tip */}
      <div className="ai-architecture-generation-dialog__next-tip">
        {allRequiredMapped
          ? "所有必填字段已映射，可以继续下一步。也可展开可选字段进一步完善。"
          : "请为每个必填字段选择对应的 CSV 列。AI 已自动识别部分映射，标记为高把握的无需修改。"}
      </div>

      {/* Required fields section */}
      <FieldUnderstandingPanel
        sectionTitle="必填字段"
        sectionIcon="🔴"
        fields={requiredFields}
        inferred={inferred}
        mapping={effectiveMapping}
        headers={importedCsv.headers}
        sampleRow={importedCsv.rows[0]?.raw}
        onChangeMapping={handleChange}
        onRequestAISuggestion={handleRequestAISuggestion}
        aiSuggestingField={aiSuggestingField}
        defaultExpanded
        readOnly={readOnly}
      />

      {/* Optional fields section */}
      <div className="ai-architecture-generation-dialog__field-section-toggle">
        <button
          type="button"
          className="ai-architecture-generation-dialog__btn-ghost"
          onClick={() => setShowOptionalFields((prev) => !prev)}
          disabled={readOnly}
        >
          {showOptionalFields
            ? `收起可选字段 (${optionalMappedCount}/${optionalFields.length} 已识别)`
            : `展开可选字段（可忽略） (${optionalMappedCount}/${optionalFields.length} 已识别)`}
        </button>
      </div>

      {showOptionalFields && (
        <FieldUnderstandingPanel
          sectionTitle="可选字段"
          sectionIcon="⚪"
          fields={optionalFields}
          inferred={inferred}
          mapping={effectiveMapping}
          headers={importedCsv.headers}
          sampleRow={importedCsv.rows[0]?.raw}
          onChangeMapping={handleChange}
          onRequestAISuggestion={handleRequestAISuggestion}
          aiSuggestingField={aiSuggestingField}
          defaultExpanded
          readOnly={readOnly}
        />
      )}

      {/* Notices / Errors */}
      {error && <div className="ai-architecture-generation-dialog__error">{error}</div>}
      {notice && (
        <div className="ai-architecture-generation-dialog__success">{notice}</div>
      )}
    </div>
  );
};
