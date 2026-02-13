import React from "react";

interface SchemeUndoToastProps {
  deletedCount: number;
  timeoutMs: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export const SchemeUndoToast: React.FC<SchemeUndoToastProps> = ({
  deletedCount,
  timeoutMs,
  onUndo,
  onDismiss,
}) => {
  return (
    <div className="scheme-undo-toast">
      <span>已删除 {deletedCount} 个方案</span>
      <button onClick={onUndo}>撤销</button>
      <button onClick={onDismiss}>✕</button>
      <div
        className="scheme-undo-toast__progress"
        style={{ animationDuration: `${timeoutMs}ms` }}
      />
    </div>
  );
};
