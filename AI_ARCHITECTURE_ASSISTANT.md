# AI 架构助手文档（当前实现）

最后更新：2026-02-16

## 1. 当前入口与页面

AI 架构助手入口：`packages/excalidraw/components/ArchitectureAssistant.tsx`

CSV 到架构图流程已切换为页面化主路径：
- `/ai/csv-fix`：导入 CSV -> 字段确认 -> 问题修复
- `/ai/draft-confirm`：范围分层 -> 架构图预览 -> 插入画布

主容器：`packages/excalidraw/components/AIArchitectureGenerationPages.tsx`
页面组件：
- `packages/excalidraw/components/pages/ai/CsvFixPage.tsx`
- `packages/excalidraw/components/pages/ai/DraftConfirmPage.tsx`

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
