import React from "react";

interface InferenceReasonBadgeProps {
  reason: string;
}

const toReasonText = (reason: string): string => {
  if (reason === "exact alias match") {
    return "exact alias match";
  }
  if (reason === "partial alias match") {
    return "partial alias match";
  }
  return reason;
};

export const InferenceReasonBadge: React.FC<InferenceReasonBadgeProps> = ({
  reason,
}) => {
  return (
    <span
      className="ai-architecture-generation-dialog__reason-badge"
      title={reason}
    >
      {toReasonText(reason)}
    </span>
  );
};

