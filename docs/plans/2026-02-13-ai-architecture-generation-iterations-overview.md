# AI 架构生成迭代总览（按当前实现更新）

日期：2026-02-13  
范围：`packages/excalidraw/components/AIArchitectureGeneration*`

## 1. 入口与主容器

1. 功能入口：
- 主菜单 `AI架构生成`
- 顶部按钮 `AI架构生成`
2. 主容器：
- `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`

## 2. 当前端到端流程

当前已收敛为三段主流程：

1. `数据工作台（workspace）`
2. `架构图视图（draft）`
3. `可信现状（calibrate）`

说明：

1. 历史步骤 `import / mapping / issues` 仅作兼容，不再作为独立导航步骤。
2. 导入与修正在同一工作台完成（用户无需频繁切页）。

## 3. 数据工作台（workspace）现状

目录：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/GuidedWorkspaceStep.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/ExpertEditOverlay.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/SharedAgGrid.tsx`

能力：

1. AG Grid 原生编辑、原生选择、分页浏览。
2. `服务名称（组件用途）` 表头内置 `AI识别` 按钮（批量补服务名）。
3. 空服务名支持行级 `AI识别` 入口。
4. 问题按类型聚合并在右侧抽屉引导修正。
5. 批量编辑为 Overlay 工具，不再单独步骤页。

## 4. 架构图视图（draft）现状

目录：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useBusinessScopeSuggestion.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useBusinessArchitectureSuggestion.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useServiceNamingSuggestion.ts`

能力：

1. 每次只处理一个业务范围（先选范围再生成）。
2. 业务范围优先使用 LLM 识别，失败回退本地分组策略。
3. 支持 AI 分层建议 + 人工拖拽调整。
4. 按业务范围生成架构图草稿（Mermaid）。

## 5. 可信现状（calibrate）现状

目录：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrateStep.tsx`

能力：

1. 基于校准任务的质量门控制。
2. 仅满足门槛后才可标记 `confirmed`。

## 6. 状态与持久化

核心模块：
- `packages/excalidraw/components/AIArchitectureGeneration/state/*`

关键点：

1. 保留原始 CSV（raw 数据）
2. 支持 `edits` 覆盖
3. 支持 `ignoredRows`
4. 支持 `aliasStore` 列名记忆
5. Dialog 会话状态持久化：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/sessionState.ts`

## 7. LLM 使用边界（当前）

仅用于“建议”而非“事实自动落库”：

1. 字段识别建议
2. 服务命名/服务语义建议
3. 业务范围建议
4. 业务分层与架构图建议

统一复用仓库既有 AI 调用能力，不引入新 AI SDK。

## 8. 当前验证命令

建议最少回归：

1. `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/GuidedWorkspaceStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/ExpertEditOverlay.test.tsx`
2. `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.test.tsx`

如需扩展回归：

1. `yarn test:architecture`
