import React, { useState, useCallback, useEffect } from "react";

import {
  getAISettings,
  setAISettings,
  type AISettings,
  runAIStream,
} from "../services/aiService";

import { Dialog } from "./Dialog";
import { useAIStream } from "./hooks/useAIStream";

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
    model: "",
    streamStallTimeoutMs: 15000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const { run: runStream, isStreaming } = useAIStream();

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

  const handleStallTimeoutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const seconds = Number(e.target.value);
      setSettingsState((prev) => ({
        ...prev,
        streamStallTimeoutMs: Number.isFinite(seconds)
          ? Math.max(5, Math.floor(seconds)) * 1000
          : prev.streamStallTimeoutMs,
      }));
      setError(null);
      setSuccess(false);
    },
    [],
  );

  const handleTest = useCallback(async () => {
    if (!settings.apiUrl.trim()) {
      setError("请输入 API URL");
      return;
    }
    if (!settings.apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }

    setError(null);
    setTestSuccess(null);
    setSuccess(false);

    try {
      const result = await runStream((signal) =>
        runAIStream(
          [{ role: "user", content: "Hi" }],
          {
            onChunk: () => {},
            onError: () => {},
          },
          signal,
          settings,
        ),
      );
      if (result.success) {
        setTestSuccess("连接成功");
      } else {
        setError(result.error || "连接失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    }
  }, [settings, runStream]);

  const handleSave = useCallback(() => {
    if (!settings.apiUrl.trim()) {
      setError("请输入 API URL");
      return;
    }
    if (!settings.apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }

    setIsSaving(true);
    setAISettings(settings);
    setSuccess(true);
    setIsSaving(false);

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
            placeholder="例如 https://api.openai.com 或完整 .../chat/completions"
          />
          <span className="ai-settings-dialog__hint">
            支持仅填域名自动补全，或填写完整端点。
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
            API 密钥仅存储在本地浏览器。
          </span>
        </div>

        <div className="ai-settings-dialog__field">
          <label htmlFor="ai-model">Model</label>
          <input
            id="ai-model"
            type="text"
            value={settings.model}
            onChange={handleChange("model")}
            placeholder="gpt-4o-mini, gpt-4o, deepseek-chat"
          />
          <span className="ai-settings-dialog__hint">
            模型名称，例如 gpt-4o-mini。
          </span>
        </div>

        <div className="ai-settings-dialog__field">
          <label htmlFor="ai-stream-stall-timeout">流式卡住阈值（秒）</label>
          <input
            id="ai-stream-stall-timeout"
            type="number"
            min={5}
            max={120}
            step={1}
            value={Math.floor((settings.streamStallTimeoutMs ?? 15000) / 1000)}
            onChange={handleStallTimeoutChange}
            placeholder="15"
          />
          <span className="ai-settings-dialog__hint">
            连续多少秒无新 token 视为卡住并自动中断，默认 15 秒。
          </span>
        </div>

        {error && <div className="ai-settings-dialog__error">{error}</div>}
        {testSuccess && (
          <div className="ai-settings-dialog__success">{testSuccess}</div>
        )}
        {success && (
          <div className="ai-settings-dialog__success">设置已保存</div>
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
              disabled={isSaving || isStreaming}
              type="button"
            >
              {isStreaming ? "测试中..." : "测试连接"}
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
