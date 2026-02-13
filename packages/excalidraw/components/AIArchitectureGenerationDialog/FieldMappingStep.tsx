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
import { RawColumnsViewer } from "./RawColumnsViewer";
import { useAliasMemory } from "./hooks/useAliasMemory";
import { useFieldMappingSuggestion } from "./hooks/useFieldMappingSuggestion";

interface FieldMappingStepProps {
  onContinue: () => void;
  onGenerateDraft: () => void;
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
}) => {
  const importedCsv = useAtomValue(importedCsvAtom);
  const [mapping, setMapping] = useAtom(fieldMappingAtom);
  const [error, setError] = useState<string | null>(null);
  const { rememberMapping } = useAliasMemory();
  const [notice, setNotice] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<StandardField | null>(null);
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
      setMapping((prev) => ({
        ...prev,
        [field]: value || undefined,
      }));
      setNotice(null);
      setEditingField(null);
    },
    [setMapping],
  );

  const handleApply = useCallback(() => {
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
  }, [effectiveMapping, onContinue, rememberMapping, setMapping]);

  const handleRequestAISuggestion = useCallback(
    async (field: StandardField) => {
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
    [importedCsv.headers, importedCsv.rows, requestSuggestion, setMapping],
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
  const displayFields = showOptionalFields ? orderedFields : requiredFields;

  if (importedCsv.headers.length === 0) {
    return (
      <div className="ai-architecture-generation-dialog__step">
        <h3>字段确认</h3>
        <p>请先完成 CSV 导入。</p>
      </div>
    );
  }

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>字段确认</h3>
      <p>仅确认关键字段 hostname/privateIp/serviceName 后才可进入问题修复。</p>
      <div className="ai-architecture-generation-dialog__summary">
        画图必需字段覆盖: {requiredMappedCount}/{requiredFields.length}
      </div>
      <div className="ai-architecture-generation-dialog__summary">
        可选字段已识别: {optionalMappedCount}/{optionalFields.length}（默认不强制）
      </div>
      <div className="ai-architecture-generation-dialog__actions">
        <button
          type="button"
          onClick={() => setShowOptionalFields((prev) => !prev)}
        >
          {showOptionalFields ? "收起可选字段" : "展开可选字段（可忽略）"}
        </button>
      </div>
      <FieldUnderstandingPanel
        fields={displayFields}
        inferred={inferred}
        mapping={effectiveMapping}
        headers={importedCsv.headers}
        editingField={editingField}
        onStartEdit={setEditingField}
        onChangeMapping={handleChange}
        onRequestAISuggestion={handleRequestAISuggestion}
        aiSuggestingField={aiSuggestingField}
      />
      <RawColumnsViewer
        headers={importedCsv.headers}
        sampleRow={importedCsv.rows[0]?.raw}
        inferred={inferred}
        mapping={effectiveMapping}
      />
      {error && <div className="ai-architecture-generation-dialog__error">{error}</div>}
      {notice && (
        <div className="ai-architecture-generation-dialog__success">{notice}</div>
      )}
      <div className="ai-architecture-generation-dialog__actions">
        <button type="button" onClick={handleApply}>
          进入问题修复
        </button>
        <button type="button" onClick={onGenerateDraft}>
          进入草图确认
        </button>
      </div>
    </div>
  );
};

