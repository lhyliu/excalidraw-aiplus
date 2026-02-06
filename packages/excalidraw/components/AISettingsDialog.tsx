import React, { useState, useCallback, useEffect } from "react";

import {
  getAISettings,
  setAISettings,
  callAIStream,
  type AISettings,
} from "../services/aiService";

import { Dialog } from "./Dialog";

import "./AISettingsDialog.scss";

interface AISettingsDialogProps {
  onClose: () => void;
}

export const AISettingsDialog: React.FC<AISettingsDialogProps> = ({
  onClose,
}) => {
  const [settings, setSettingsState] = useState<AISettings>({
    apiUrl: "",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  // Load existing settings on mount
  useEffect(() => {
    const existingSettings = getAISettings();
    if (existingSettings) {
      setSettingsState(existingSettings);
    }
  }, []);

  const handleChange = useCallback(
    (field: keyof AISettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setSettingsState((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
      setError(null);
      setSuccess(false);
    },
    [],
  );

  const handleTest = useCallback(async () => {
    // Validate
    if (!settings.apiUrl.trim()) {
      setError("请输入API URL");
      return;
    }
    if (!settings.apiKey.trim()) {
      setError("请输入API Key");
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestSuccess(null);
    setSuccess(false);

    try {
      const result = await callAIStream(
        [{ role: "user", content: "Hi" }],
        {
          onChunk: () => { },
          onError: () => { },
        },
        undefined,
        settings,
      );

      if (result.success) {
        setTestSuccess("连接成功! (Connection successful)");
      } else {
        setError(result.error || "连接失败 (Connection failed)");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败 (Connection failed)");
    } finally {
      setIsTesting(false);
    }
  }, [settings]);

  const handleSave = useCallback(() => {
    // Validate
    if (!settings.apiUrl.trim()) {
      setError("请输入API URL");
      return;
    }
    if (!settings.apiKey.trim()) {
      setError("请输入API Key");
      return;
    }

    setIsSaving(true);
    setAISettings(settings);
    setSuccess(true);
    setIsSaving(false);

    // Close after a short delay to show success
    setTimeout(() => {
      onClose();
    }, 500);
  }, [settings, onClose]);

  return (
    <Dialog
      className="ai-settings-dialog"
      onCloseRequest={onClose}
      title="AI Settings"
      size="small"
    >
      <div className="ai-settings-dialog__content">
        <div className="ai-settings-dialog__field">
          <label htmlFor="ai-api-url">API URL</label>
          <input
            id="ai-api-url"
            type="text"
            value={settings.apiUrl}
            onChange={handleChange("apiUrl")}
            placeholder="https://api.openai.com"
          />
          <span className="ai-settings-dialog__hint">
            支持基础地址 (如 https://api.openai.com) 或完整 Endpoint (如 .../chat/completions, .../responses)
          </span>
        </div>

        <div className="ai-settings-dialog__field">
          <label htmlFor="ai-api-key">API Key</label>
          <input
            id="ai-api-key"
            type="password"
            value={settings.apiKey}
            onChange={handleChange("apiKey")}
            placeholder="sk-..."
          />
          <span className="ai-settings-dialog__hint">
            您的API密钥，将存储在浏览器本地
          </span>
        </div>

        <div className="ai-settings-dialog__field">
          <label htmlFor="ai-model">Model</label>
          <input
            id="ai-model"
            type="text"
            value={settings.model}
            onChange={handleChange("model")}
            placeholder="gpt-4o-mini"
          />
          <span className="ai-settings-dialog__hint">
            模型名称，例如 gpt-4o-mini, gpt-4o, deepseek-chat
          </span>
        </div>

        {error && <div className="ai-settings-dialog__error">{error}</div>}
        {testSuccess && (
          <div className="ai-settings-dialog__success">{testSuccess}</div>
        )}
        {success && (
          <div className="ai-settings-dialog__success">设置已保存!</div>
        )}

        <div className="ai-settings-dialog__actions">
          <button
            className="ai-settings-dialog__button ai-settings-dialog__button--secondary"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <div style={{ flex: 1 }}>
            <button
              className="ai-settings-dialog__button ai-settings-dialog__button--secondary"
              onClick={handleTest}
              disabled={isSaving || isTesting}
              type="button"
            >
              {isTesting ? "测试中..." : "测试连接"}
            </button>
          </div>
          <button
            className="ai-settings-dialog__button ai-settings-dialog__button--primary"
            onClick={handleSave}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
