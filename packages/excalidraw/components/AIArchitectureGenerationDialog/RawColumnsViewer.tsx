import React, { useMemo, useState } from "react";
import type { FieldInferenceResult, FieldMapping, StandardField } from "../AIArchitectureGeneration";

interface RawColumnsViewerProps {
  headers: string[];
  sampleRow?: Record<string, string>;
  inferred: FieldInferenceResult;
  mapping: FieldMapping;
}

export const RawColumnsViewer: React.FC<RawColumnsViewerProps> = ({
  headers,
  sampleRow,
  inferred,
  mapping,
}) => {
  const [open, setOpen] = useState(true);
  const previewHeaders = useMemo(() => headers.slice(0, 12), [headers]);
  const fieldByHeader = useMemo(() => {
    const result: Partial<Record<string, { field: StandardField; score?: number }>> = {};
    (Object.keys(mapping) as StandardField[]).forEach((field) => {
      const header = mapping[field];
      if (!header) {
        return;
      }
      const score = inferred[field]?.find((item) => item.header === header)?.score;
      result[header] = { field, score };
    });
    return result;
  }, [inferred, mapping]);

  if (headers.length === 0) {
    return null;
  }

  return (
    <section className="ai-architecture-generation-dialog__raw-columns">
      <button type="button" onClick={() => setOpen((prev) => !prev)}>
        {open ? "收起透视区" : "展开透视区"}
      </button>
      <div className="ai-architecture-generation-dialog__summary">
        读懂你的表格：原始列 {"->"} AI 理解
      </div>
      {open && (
        <div className="ai-architecture-generation-dialog__raw-columns-grid">
          {previewHeaders.map((header) => (
            <article
              key={header}
              className={`ai-architecture-generation-dialog__raw-columns-item${
                !fieldByHeader[header] || (fieldByHeader[header]?.score ?? 0) < 0.7
                  ? " is-low-confidence"
                  : ""
              }`}
            >
              <strong>{header}</strong>
              <span>{sampleRow?.[header] ?? "-"}</span>
              <div className="ai-architecture-generation-dialog__summary">
                AI 理解: {fieldByHeader[header]?.field ?? "未识别"}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
