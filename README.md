# Excalidraw (AI Enhanced Edition) / AI 增强版

<p align="center">
  <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" alt="Excalidraw" width="100%" />
</p>

This is a customized version of [Excalidraw](https://excalidraw.com) enhanced with local-first AI capabilities.
<br/>
这是一个增强了本地优先 AI 能力的 [Excalidraw](https://excalidraw.com) 定制版本。

## ✅ What This Repo Is / 本仓库是什么
- A fork of Excalidraw with local-first AI features integrated into the app UI.
  <br/>基于 Excalidraw 的分支，集成了本地优先的 AI 功能。
- AI features are opt-in and use your own API endpoint and key.
  <br/>AI 功能为可选项，使用你自己的 API 地址与密钥。
- Works with OpenAI-compatible providers (cloud or local).
  <br/>兼容 OpenAI 风格接口（云端或本地）。

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

1. **Clone Repository / 克隆仓库**
   ```bash
   git clone https://github.com/lhyliu/excalidraw-aiplus.git
   cd excalidraw-aiplus
   ```

2. **Install Dependencies / 安装依赖**
   ```bash
   yarn install
   ```

3. **Run Locally / 本地运行**
   ```bash
   yarn start
   ```

4. **Configure AI / 配置 AI**
   - Open the application in browser (default `http://localhost:3001`).
     <br/>在浏览器打开应用（默认 `http://localhost:3001`）。
   - Click **Main Menu** (Hamburger icon) -> **AI Settings**.
     <br/>点击 **主菜单**（汉堡图标） -> **AI Settings**。
   - Input your **API URL** and **API Key**.
     <br/>输入您的 **API 地址** 和 **API 密钥**。

## 🧩 AI Settings Example / AI 设置示例
Fill the dialog fields as follows:
<br/>按照下列方式填写弹窗字段：

- **API URL**: `https://api.openai.com/v1` (or your compatible endpoint)
  <br/>**API 地址**：`https://api.openai.com/v1`（或你的兼容接口地址）
- **API Key**: `sk-...` (your own key)
  <br/>**API 密钥**：`sk-...`（你的密钥）
- **Model**: `gpt-4o` (example)
  <br/>**模型**：`gpt-4o`（示例）

If you are using a local or proxy endpoint, ensure it supports OpenAI-compatible chat/completions.
<br/>如使用本地或代理端点，请确保其支持 OpenAI 兼容的 chat/completions 接口。

## 📁 Repository Structure / 目录结构
- `packages/excalidraw`: Core editor and UI.
  <br/>核心编辑器与 UI。
- `excalidraw-app`: App shell and integration layer.
  <br/>应用外壳与集成层。
- `packages/element`, `packages/common`, `packages/utils`: Shared packages.
  <br/>共享基础包。
- `examples/`: Example projects.
  <br/>示例工程。
- `dev-docs/`: Documentation site (optional).
  <br/>文档站点（可选）。

## 🧪 Useful Scripts / 常用脚本
- `yarn start`: Run the app locally.
  <br/>本地运行应用。
- `yarn test`: Run tests.
  <br/>运行测试。
- `yarn build`: Build production assets.
  <br/>构建生产包。

## 🔒 Privacy & Data / 隐私与数据
- API keys are stored in `localStorage` in your browser.
  <br/>API Key 仅保存在浏览器本地 `localStorage`。
- No keys are committed to the repo.
  <br/>密钥不会被提交到仓库。

## 🤝 Original Excalidraw / 原版 Excalidraw

Excalidraw is a virtual whiteboard for sketching hand-drawn like diagrams.
Excalidraw 是一个用于绘制手绘风格图表的虚拟白板。

- [Website / 官网](https://excalidraw.com)
- [Documentation / 文档](https://docs.excalidraw.com)
- [Contributing / 贡献指南](https://github.com/excalidraw/excalidraw/blob/master/CONTRIBUTING.md)

License: MIT
