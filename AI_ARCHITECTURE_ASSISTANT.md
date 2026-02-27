# AI 架构助手文档（当前实现）

说明：本文件用于记录 AI 架构助手的产品/实现现状，不定义编码代理行为规范。代理执行规则请以 `AGENTS.md` 为准。


最后更新：2026-02-27

## 1. 当前入口与页面

AI 架构助手入口：`packages/excalidraw/components/ArchitectureAssistant.tsx`

CSV 到架构图流程已切换为页面化主路径：
- `/ai/csv-fix`：导入 CSV -> 字段确认 -> 问题修复
- `/ai/draft-confirm`：全景生成 -> 业务聚焦分层（可选）-> 架构图预览 -> 插入画布

主容器：`packages/excalidraw/components/AIArchitectureGenerationPages.tsx`
页面组件：
- `packages/excalidraw/components/pages/ai/CsvFixPage.tsx`
- `packages/excalidraw/components/pages/ai/DraftConfirmPage.tsx`
- `packages/excalidraw/components/pages/ai/GenerationWorkflowHeader.tsx`（全局唯一步骤导航）

当前导航与进度规则（2026-02-27）：
- 顶部仅保留一套全局步骤导航（导入/字段确认/问题修复/草图确认）。
- 引入 `viewStep`（查看步骤）与 `step`（真实进度步骤）分离：
  - 点击步骤用于切换页面视图（`viewStep`）。
  - 仅在完成关键动作后推进真实进度（`step`）。
- 未满足前置条件时允许进入页面只读预览（view-only），并显示原因提示；关键写操作与 AI 触发按钮禁用。

## 2. 已删除的旧流程壳（物理删除）

以下文件已删除，不再作为主流程：
- `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/layout/WorkflowShell.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/layout/CenterStage.tsx`
- `packages/excalidraw/components/AIArchitectureGeneration/compat/index.ts`
- `packages/excalidraw/components/AIArchitectureGeneration/state/persistence/index.ts`
- `packages/excalidraw/components/AIArchitectureGeneration/state/persistence/migration.ts`

说明：当前阶段不做历史兼容迁移逻辑。

## 3. AI 调用模式（任务化 + SSE）

前端统一通过任务客户端调用：
- `packages/excalidraw/services/aiTaskService.ts`

接口：
- `createAiTask(type, payload)`
- `subscribeAiTask(taskId, handlers)`
- `cancelAiTask(taskId)`

任务类型：
- `service_name_fill`
- `business_scope`
- `business_layering`
- `diagram_generate`

事件：
- `progress`
- `partial`
- `heartbeat`
- `done`
- `error`

已接入以下 hooks：
- `useServiceSemanticSuggestion`
- `useServiceNamingSuggestion`
- `useBusinessScopeSuggestion`
- `useBusinessArchitectureSuggestion`

## 4. 后端代理（OpenAI SDK 兼容）

目录：`backend-proxy/`

后端接口：
- `POST /api/ai/tasks`
- `GET /api/ai/tasks/:taskId/stream`
- `POST /api/ai/tasks/:taskId/cancel`

实现方式：
- 使用官方 `openai` SDK
- 通过 `baseURL + apiKey + model` 兼容多供应商
- 默认支持火山引擎 Ark（OpenAI-compatible）

## 5. 状态与持久化

核心状态在 `packages/excalidraw/components/AIArchitectureGeneration/state/`。

当前策略：
- 本地存储保留工作区数据（source/mapping/edits/draft）
- 仅用户手动清空时重置
- 清空 atom：`resetAIArchitectureWorkspaceAtom`

草图会话（draft）关键字段（2026-02-26）：
- `draftSelectedScopeIds`：业务分区多选（默认全选）
- `draftViewMode`：`panorama | focus`
- `draftPanoramaDiagram`：全景 Mermaid
- `draftPanoramaDiagramStatus`：全景图状态
- 兼容保留：`draftActiveScopeId`、`draftLayerEditsByScope`、`draftDiagramByScope`、`draftDiagramStatusByScope`（用于主业务局部分层与局部图）

语义变更：
- “业务范围”不再用于裁剪数据输入，改为全景视图的分区控制器。
- 默认流程优先生成全景图；“主业务”用于局部分层编辑与细化。

提示词约束（2026-02-26）：
- `business_scope`：允许输出共享基础能力分区（如中间件平台）。
- `business_layering`：默认全景、服务级粒度、限制每业务核心节点数量、保留跨业务主路径，并新增 `topologySummary` 输出字段。

## 6. 开发与验证

前端：
```bash
yarn start
```

后端代理：
```bash
yarn start:ai-proxy
```

验证命令：
```bash
yarn test:typecheck
yarn test:app --watch=false
```

## 7. 维护约定

1. 变更页面流转时，同步更新“1. 当前入口与页面”。
2. 变更任务协议时，同步更新“3. AI 调用模式”。
3. 变更代理接口时，同步更新“4. 后端代理”。
4. 删除/新增关键文件时，在本文档记录物理变更。

