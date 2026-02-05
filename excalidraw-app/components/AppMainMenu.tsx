import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
  OpenAIIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState, useCallback } from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";

import { saveDebugState } from "./DebugCanvas";

import { AISettingsDialog } from "@excalidraw/excalidraw/components/AISettingsDialog";
import { ArchitectureOptimizationDialog } from "@excalidraw/excalidraw/components/ArchitectureOptimizationDialog";
import { useExcalidrawElements } from "@excalidraw/excalidraw/components/App";

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
          架构优化
        </MainMenu.Item>
        <MainMenu.Item
          icon={OpenAIIcon}
          onSelect={() => setShowAISettings(true)}
        >
          AI Settings
        </MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.ItemLink
          icon={ExcalLogo}
          href={`${import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
          className=""
        >
          Excalidraw+
        </MainMenu.ItemLink>
        <MainMenu.DefaultItems.Socials />
        <MainMenu.ItemLink
          icon={loginIcon}
          href={`${import.meta.env.VITE_APP_PLUS_APP}${isExcalidrawPlusSignedUser ? "" : "/sign-up"
            }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
          className="highlighted"
        >
          {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
        </MainMenu.ItemLink>
        {isDevEnv() && (
          <MainMenu.Item
            icon={eyeIcon}
            onClick={() => {
              if (window.visualDebug) {
                delete window.visualDebug;
                saveDebugState({ enabled: false });
              } else {
                window.visualDebug = { data: [] };
                saveDebugState({ enabled: true });
              }
              props?.refresh();
            }}
          >
            Visual Debug
          </MainMenu.Item>
        )}
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

