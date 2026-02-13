import { OpenAIIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";

import { loadSavedDebugState, saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  onOpenAISettings: () => void;
  onOpenArchitectureOptimization: () => void;
  onOpenAIArchitectureGeneration: () => void;
}> = React.memo((props) => {
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
          onSelect={props.onOpenArchitectureOptimization}
        >
          AI架构助手
        </MainMenu.Item>
        <MainMenu.Item
          icon={OpenAIIcon}
          onSelect={props.onOpenAIArchitectureGeneration}
        >
          AI架构生成
        </MainMenu.Item>
        <MainMenu.Item icon={OpenAIIcon} onSelect={props.onOpenAISettings}>
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
    </>
  );
});
