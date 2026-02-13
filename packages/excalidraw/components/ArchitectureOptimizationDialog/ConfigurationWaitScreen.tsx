import React from "react";

interface ConfigurationWaitScreenProps {
  showConfigExample: boolean;
  onOpenAISettings: () => void;
  onToggleConfigExample: () => void;
}

export const ConfigurationWaitScreen: React.FC<ConfigurationWaitScreenProps> = ({
  showConfigExample,
  onOpenAISettings,
  onToggleConfigExample,
}) => {
  return (
    <div className="architecture-optimization-dialog__not-configured">
      <div className="architecture-optimization-dialog__not-configured-card">
        <div className="architecture-optimization-dialog__not-configured-main">
          <div className="architecture-optimization-dialog__not-configured-badge">
            AI 未连接
          </div>
          <h3>完成 AI 配置后即可开始架构分析</h3>
          <p>
            当前尚未配置 API 地址、密钥或模型。配置完成后可在建议页直接进行分析、生成方案与预览架构图。
          </p>
          <ol className="architecture-optimization-dialog__not-configured-steps">
            <li>打开 AI 设置</li>
            <li>填写 API URL、API Key、模型</li>
            <li>返回本页面开始分析</li>
          </ol>
          {showConfigExample && (
            <pre className="architecture-optimization-dialog__not-configured-example">
              {`API URL: https://api.openai.com/v1
API Key: sk-***
Model: gpt-4o-mini`}
            </pre>
          )}
          <div className="architecture-optimization-dialog__not-configured-actions">
            <button
              className="architecture-optimization-dialog__config-button"
              onClick={onOpenAISettings}
            >
              打开AI设置
            </button>
            <button
              className="architecture-optimization-dialog__config-button architecture-optimization-dialog__config-button--ghost"
              onClick={onToggleConfigExample}
            >
              {showConfigExample ? "收起配置示例" : "查看配置示例"}
            </button>
          </div>
        </div>
        <div
          className="architecture-optimization-dialog__not-configured-visual"
          aria-hidden="true"
        >
          <div className="architecture-optimization-dialog__not-configured-node">
            API
          </div>
          <div className="architecture-optimization-dialog__not-configured-line" />
          <div className="architecture-optimization-dialog__not-configured-node">
            建议流
          </div>
          <div className="architecture-optimization-dialog__not-configured-line" />
          <div className="architecture-optimization-dialog__not-configured-node">
            新架构图
          </div>
        </div>
      </div>
    </div>
  );
};
