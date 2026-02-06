# Excalidraw-AIPlus 项目功能说明

## 项目概述

本项目基于 Excalidraw 开源绘图工具，增加了 AI 辅助架构分析和优化功能，帮助用户智能化地设计和改进系统架构图。

---

## 核心功能

### 🤖 1. AI 架构助手

**功能描述**：
- 与 AI 进行多轮对话，分析当前架构图的问题和优化方向
- 自动提取画布上的图形元素信息作为分析上下文
- 对话历史自动保存，刷新页面后可恢复

**使用方法**：
1. 在画布上绘制或导入架构图
2. 打开 **AI 架构助手** 对话框
3. 点击 **开始分析当前架构** 或直接输入问题
4. 与 AI 讨论架构优化建议

---

### ✨ 2. 生成优化方案

**功能描述**：
- 根据对话内容自动生成架构优化总结
- AI 自动生成优化后的 Mermaid 架构图代码
- 在弹窗中实时预览新架构图

**使用方法**：
1. 在 AI 架构助手中完成对话讨论
2. 点击 **✨ 生成优化方案** 按钮
3. 查看变更总结和新架构预览

---

### 📊 3. 插入并对比

**功能描述**：
- 将新架构图插入到画布上原图右侧
- 支持原图和优化后新图的并排对比

**使用方法**：
1. 生成优化方案后，点击 **插入并对比** 按钮
2. 新图将自动放置在原图旁边
3. 可以直接在画布上进行对比分析

---

## 技术架构

### 关键组件

| 组件 | 路径 | 说明 |
|------|------|------|
| AI 对话界面 | `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx` | 主对话组件 |
| 样式文件 | `packages/excalidraw/components/ArchitectureOptimizationDialog.scss` | UI 样式和动画 |
| AI 服务层 | `packages/excalidraw/services/aiService.ts` | API 调用和提示词 |
| Mermaid 转换 | `packages/excalidraw/components/TTDDialog/common.ts` | Mermaid → Excalidraw |

### AI 服务特性

- **多格式支持**：兼容 OpenAI 和 Volcengine API 格式
- **流式响应**：SSE 实时输出，提升用户体验
- **智能过滤**：自动过滤 AI 思考链内容，只显示最终结果

---

## 快速开始

### 安装依赖

```bash
yarn install
```

### 启动开发服务器

```bash
yarn start
```

### 访问应用

打开浏览器访问 http://localhost:5173

### 配置 AI API

1. 打开应用设置
2. 配置 AI API 地址和密钥
3. 保存设置后即可使用 AI 功能

---

## UI/UX 特性

- 🎨 消息滑入动画
- 🌟 弹窗毛玻璃背景效果
- 💜 渐变色按钮设计
- 📜 平滑滚动到最新消息
- 🔄 实时流式输出显示

---

## 许可证

基于 MIT 许可证开源。
