# Excalidraw (AI Enhanced Edition) / AI 增强版

<p align="center">
  <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" alt="Excalidraw" width="100%" />
</p>

This is a customized version of [Excalidraw](https://excalidraw.com) enhanced with local-first AI capabilities.
<br/>
这是一个增强了本地优先 AI 能力的 [Excalidraw](https://excalidraw.com) 定制版本。

## ✨ New AI Features / 新增 AI 功能

### 🤖 AI Architecture Assistant / AI 架构助手
Analyze your architecture diagrams intelligently.
智能分析您的架构图。

- **Smart Analysis**: Automatically extracts diagram elements (nodes, edges, text) to understand your system design.
  <br/>**智能分析**：自动提取图表元素（节点、连线、文本）以理解系统设计。
- **Optimization Advice**: Provides professional suggestions on Security, Availability, and Performance.
  <br/>**优化建议**：提供关于安全性、可用性和性能的专业建议。
- **Interactive Chat**: Refine the advice through a conversational interface.
  <br/>**交互式对话**：通过对话界面进一步调整和细化建议。
- **Cost Efficient**: Triggered on-demand to save tokens.
  <br/>**成本高效**：按需触发，节省 Token 消耗。

### 📝 Text to Diagram (Unified) / 文字生成图表（统一版）
Generate diagrams from natural language.
通过自然语言生成图表。

- **Mermaid Support**: Flowcharts, Sequence, Class diagrams, and more.
  <br/>**Mermaid 支持**：支持流程图、时序图、类图等多种图表。
- **Robust Parsing**: Enhanced logic to handle various AI output formats (Markdown code blocks, loose text).
  <br/>**增强解析**：增强了对各种 AI 输出格式（Markdown 代码块、纯文本）的处理逻辑。
- **Unified Config**: Shares the same API credentials with the Architecture Assistant.
  <br/>**统一配置**：与架构助手共享同一套 API 凭证。

### ⚙️ Customizable AI Settings / 自定义 AI 设置
Full control over your AI provider.
完全掌控您的 AI 服务提供商。

- **Custom API Endpoint**: Works with OpenAI or any compatible provider (e.g., local LLMs).
  <br/>**自定义 API 端点**：兼容 OpenAI 或任何兼容的提供商（如本地大模型）。
- **Privacy First**: API Keys are stored locally in your browser (`localStorage`).
  <br/>**隐私优先**：API 密钥仅存储在您的浏览器本地 (`localStorage`)。
- **Model Selection**: Choose the model that fits your needs (e.g., `gpt-4o`, `claude-3-5-sonnet`).
  <br/>**模型选择**：选择适合您需求的模型（如 `gpt-4o`, `claude-3-5-sonnet`）。

### 🛠️ Developer Tools / 开发者工具
- **Visual Debugger**: Restored the visual rendering debugger. Toggle it via the Main Menu to inspect rendering frame-by-frame.
  <br/>**可视化调试器**：恢复了渲染调试器。通过主菜单切换，可逐帧检查渲染过程。
- **Clean UI**: Streamlined menu by removing non-essential integrations for a focused experience.
  <br/>**简洁 UI**：移除了不必要的集成菜单，提供更专注的用户体验。

## 🚀 Getting Started / 快速开始

1. **Install Dependencies / 安装依赖**
   ```bash
   yarn
   ```

2. **Run Locally / 本地运行**
   ```bash
   yarn start
   ```

3. **Configure AI / 配置 AI**
   - Open the application in browser (default `http://localhost:3001`).
     <br/>在浏览器打开应用（默认 `http://localhost:3001`）。
   - Click **Main Menu** (Hamburger icon) -> **AI Settings**.
     <br/>点击 **主菜单**（汉堡图标） -> **AI Settings**。
   - Input your **API URL** and **API Key**.
     <br/>输入您的 **API 地址** 和 **API 密钥**。

## 🤝 Original Excalidraw / 原版 Excalidraw

Excalidraw is a virtual whiteboard for sketching hand-drawn like diagrams.
Excalidraw 是一个用于绘制手绘风格图表的虚拟白板。

- [Website / 官网](https://excalidraw.com)
- [Documentation / 文档](https://docs.excalidraw.com)
- [Contributing / 贡献指南](https://github.com/excalidraw/excalidraw/blob/master/CONTRIBUTING.md)

License: MIT
