/**
 * Unified AI architecture assistant entry.
 * Switches between optimization and CSV generation views.
 */
import React, { useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import { AIArchitectureGenerationDialog } from "./AIArchitectureGenerationDialog";
import { ArchitectureOptimizationDialog } from "./ArchitectureOptimizationDialog";
import { ArchitectureAssistantErrorBoundary } from "./ArchitectureAssistantErrorBoundary";

import "./ArchitectureAssistant.scss";

type AssistantTab = "optimize" | "generate";

interface ArchitectureAssistantProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
  defaultTab?: AssistantTab;
}

export const ArchitectureAssistant: React.FC<ArchitectureAssistantProps> = ({
  elements,
  onClose,
  onOpenAISettings,
  defaultTab = "optimize",
}) => {
  const [activeTab, setActiveTab] = useState<AssistantTab>(defaultTab);

  return (
    <ArchitectureAssistantErrorBoundary>
      <>
        <div className="architecture-assistant__tab-bar">
          <button
            className={`architecture-assistant__tab ${
              activeTab === "optimize"
                ? "architecture-assistant__tab--active"
                : ""
            }`}
            onClick={() => setActiveTab("optimize")}
          >
            {t("labels.aiCanvasOptimizeTab")}
          </button>
          <button
            className={`architecture-assistant__tab ${
              activeTab === "generate"
                ? "architecture-assistant__tab--active"
                : ""
            }`}
            onClick={() => setActiveTab("generate")}
          >
            {t("labels.aiCsvGenerateTab")}
          </button>
        </div>

        {activeTab === "optimize" ? (
          <ArchitectureOptimizationDialog
            elements={elements}
            onClose={onClose}
            onOpenAISettings={onOpenAISettings}
          />
        ) : (
          <AIArchitectureGenerationDialog onClose={onClose} />
        )}
      </>
    </ArchitectureAssistantErrorBoundary>
  );
};
