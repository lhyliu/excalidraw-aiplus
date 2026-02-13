import React from "react";

interface CenterStageProps {
  children: React.ReactNode;
}

export const CenterStage: React.FC<CenterStageProps> = ({ children }) => {
  return <section className="ai-architecture-generation-dialog__center-panel">{children}</section>;
};

