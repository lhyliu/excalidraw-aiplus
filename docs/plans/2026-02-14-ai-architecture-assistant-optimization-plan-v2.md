# AI 架构功能整改计划 v2（对齐现状与可验收版）

> 归档说明：该文件为执行版（含状态与验收结果）。

> 状态：已完成（本轮整改）  
> 当前进度：P0/P1/P2 全部落地，验收命令通过（2026-02-13）

本计划先修复“文档与代码不一致、验收脚本失真”的基础问题，再做组件拆分、样式模块化、UX 打磨和工程化完善。

---

## 0. 公共接口与类型变更

- [x] `excalidraw-app/components/AppMainMenu.tsx` 移除 `onOpenAIArchitectureGeneration` prop 与“AI架构生成”菜单项，仅保留“AI架构助手”。
- [x] `excalidraw-app/App.tsx` 删除对应状态与回调分支，保留统一入口调用。
- [x] `packages/excalidraw/components/ArchitectureAssistant.tsx` 保留 `defaultTab`，默认行为仍为 `optimize`。
- [x] `scripts/test-architecture-fix.js` 校验口径改为 `renderingSchemeIds` 与 `isPreparingInsert`。
- [x] 不引入破坏性模型变更，`Scheme`/`generationSnapshot`/持久化字段保持兼容。

---

## 1. 阶段 P0：事实对齐与门禁修复（必须先完成）

目标：让“文档、脚本、代码、验收结果”一致。

- [x] 修正 `scripts/test-architecture-fix.js` 旧变量校验（`renderingSchemes` -> `renderingSchemeIds`）。
- [x] 更新 `plan20260214.md` 阶段状态与测试口径，移除过时“15/24 文件”计数表达。
- [x] 更新 `AI_ARCHITECTURE_ASSISTANT.md` 失效的 `ai/generators` 与示例代码，改为 hook + `runAIStream` 架构。
- [x] 收敛主菜单入口，仅保留“AI架构助手”。

验收命令：

1. `yarn test:architecture`
2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`

通过标准：

1. 两条命令均通过。
2. 主菜单只出现一个 AI 主入口，功能通过 Assistant 内 Tab 切换覆盖原能力。

---

## 2. 阶段 P1：组件拆分（ArchitectureOptimizationDialog）

目标：将巨型组件降为“编排层”。

- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/ConfigurationWaitScreen.tsx`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/ClearSchemesConfirmDialog.tsx`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/SchemeUndoToast.tsx`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/useArchitecturePersistence.ts`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePreviewRenderer.ts`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePlanGeneration.ts`
- [x] 修改 `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`，仅保留状态编排与子组件装配。
- [x] 保持 `PreviewPage.tsx` 与 `WorkflowPage.tsx` 以展示层为主。

通过标准：

1. `ArchitectureOptimizationDialog.tsx` 行数显著下降（目标 < 1200 行）。
2. 行为不变，现有 integration/test 全通过。

---

## 3. 阶段 P1：样式模块化与死样式清理

目标：结束单文件 4000+ 行样式维护模式。

- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_tokens.scss`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_layout.scss`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_chat.scss`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_workflow.scss`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_preview.scss`
- [x] 新增 `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_overlays.scss`
- [x] `ArchitectureOptimizationDialog.scss` 收敛为 import + 少量兼容覆盖。
- [x] 删除 `ArchitectureOptimizationDialog.layout.scss`，避免双样式源。

通过标准：

1. 样式目录职责清晰。
2. 对话、建议页、预览页、清空确认、未配置页无可见回归。

---

## 4. 阶段 P2：UX 与性能打磨

目标：补齐“感知性能”和“失败可理解性”。

- [x] `PreviewPage.tsx` 增加渲染中骨架与空态区分（无数据/渲染中/失败）。
- [x] `WorkflowPage.tsx` 增加建议池空态与恢复提示文案强化。
- [x] `AIArchitectureGenerationDialog` 工作台路径增加统一加载反馈。
- [x] 小屏断点整理（优先 <=960 和 <=600）。

通过标准：

1. 用户可明确区分“空状态 vs 加载中 vs 错误”。
2. 移动端关键操作可完成，不出现按钮遮挡。

---

## 5. 阶段 P2：工程化完善

目标：提升稳定性与可维护性。

- [x] i18n 抽取：将 AI 架构模块硬编码文案迁移到 `packages/excalidraw/locales/en.json` 与 `packages/excalidraw/locales/zh-CN.json`。
- [x] Atoms 测试补齐：为 `chatAtoms/schemeAtoms/workflowAtoms/uiAtoms` 添加纯逻辑测试。
- [x] 局部错误隔离：为 `ArchitectureAssistant` 增加局部错误边界。
- [x] 文档闭环：同步更新 `plan20260214.md` 与 `AI_ARCHITECTURE_ASSISTANT.md` 状态、命令与验收清单。

通过标准：

1. 新增测试稳定通过。
2. 文案走 i18n key，不新增硬编码中文。
3. 文档可直接作为发布验收依据。

---

## 6. 回归验收清单

1. 统一入口：主菜单单入口可进入助手并在 Tab 间切换两类能力。
2. 生成语义：新建/更新跳转、快照冻结、纠偏重试保持正确。
3. 持久化：聊天/建议池/方案/页面状态可恢复。
4. 预览体验：渲染中禁用插入，完成后可插入，空态/错误提示明确。
5. 门禁：`yarn test:architecture` 与关键 `yarn test:app --watch=false ...` 通过。

---

## 7. 执行假设

1. 菜单采用单入口统一，不保留“AI架构生成”独立菜单项。
2. 本轮不改动持久化 schema，只做兼容性安全改造。
3. i18n 首批覆盖 `en` 与 `zh-CN`，其余语种沿用回退策略。
4. 本轮聚焦结构重整与体验修复，不新增业务能力。

---

## 8. 验收记录（2026-02-13）

1. `yarn test:architecture`：通过。
2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`：通过。
3. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/atoms/atoms.test.ts`：通过。
4. `yarn test:app --watch=false`：通过（125 files / 1296 tests passed）。
