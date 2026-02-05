import { OpenAIIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState, useCallback } from "react";

import { AISettingsDialog } from "@excalidraw/excalidraw/components/AISettingsDialog";
import { ArchitectureOptimizationDialog } from "@excalidraw/excalidraw/components/ArchitectureOptimizationDialog";
import { useExcalidrawElements } from "@excalidraw/excalidraw/components/App";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import {
  saveDebugState,
  loadSavedDebugState,
} from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
}> = React.memo((props) => {
  const [showAISettings, setShowAISettings] = useState(false);
  const [showArchitectureOptimization, setShowArchitectureOptimization] =
    useState(false);
  const elements = useExcalidrawElements();

  const handleOpenAISettings = useCallback(() => {
    setShowArchitectureOptimization(false);
    setShowAISettings(true);
  }, []);

  return (
    <>
      <MainMenu>
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.DefaultItems.SaveToActiveFile />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        {props.isCollabEnabled && (
          <MainMenu.DefaultItems.LiveCollaborationTrigger
            isCollaborating={props.isCollaborating}
            onSelect={() => props.onCollabDialogOpen()}
          />
        )}
        <MainMenu.DefaultItems.CommandPalette className="highlighted" />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.Item
          icon={OpenAIIcon}
          onSelect={() => setShowArchitectureOptimization(true)}
        >
          AI架构助手
        </MainMenu.Item>
        <MainMenu.Item
          icon={OpenAIIcon}
          onSelect={() => setShowAISettings(true)}
        >
          AI Settings
        </MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ToggleTheme
          allowSystemTheme
          theme={props.theme}
          onSelect={props.setTheme}
        />
        <MainMenu.ItemCustom>
          <LanguageList style={{ width: "100%" }} />
        </MainMenu.ItemCustom>
        <MainMenu.DefaultItems.ChangeCanvasBackground />

        {import.meta.env.DEV && (
          <MainMenu.Item
            onSelect={() => {
              const current = loadSavedDebugState();
              const next = !current.enabled;
              saveDebugState({ enabled: next });
              if (next) {
                window.visualDebug = { data: [] };
              } else {
                delete window.visualDebug;
              }
              // Force reload to apply changes (since DebugCanvas checks on mount/render?)
              // Actually App.tsx checks loadSavedDebugState on mount.
              // Maybe we need to reload page? Or update state?
              // For now, let's just toggle and reload if needed.
              window.location.reload();
            }}
          >
            Toggle Visual Debug
          </MainMenu.Item>
        )}
      </MainMenu>

      {showAISettings && (
        <AISettingsDialog onClose={() => setShowAISettings(false)} />
      )}

      {showArchitectureOptimization && (
        <ArchitectureOptimizationDialog
          elements={elements}
          onClose={() => setShowArchitectureOptimization(false)}
          onOpenAISettings={handleOpenAISettings}
        />
      )}
    </>
  );
});
