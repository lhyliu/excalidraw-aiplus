import React from "react";

import { t } from "../i18n";

interface ArchitectureAssistantErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

interface ArchitectureAssistantErrorBoundaryProps {
  children: React.ReactNode;
}

export class ArchitectureAssistantErrorBoundary extends React.Component<
  ArchitectureAssistantErrorBoundaryProps,
  ArchitectureAssistantErrorBoundaryState
> {
  state: ArchitectureAssistantErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error) {
    console.error("ArchitectureAssistant crashed:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="architecture-assistant__error-fallback">
        <h3>{t("labels.aiArchitectureAssistantErrorTitle")}</h3>
        <p>{t("labels.aiArchitectureAssistantErrorHint")}</p>
        {this.state.errorMessage && <code>{this.state.errorMessage}</code>}
      </div>
    );
  }
}
