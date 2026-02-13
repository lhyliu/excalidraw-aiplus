# AI 架构功能整改计划 v2（对齐现状与可验收版）

> 归档说明：该文件为原始 v2 草案基线版本，保留用于与执行版对照。

## 摘要
本计划先修复“文档与代码不一致、验收脚本失真”的基础问题，再做组件拆分、样式模块化、UX 打磨和工程化完善。  
已确认入口策略采用：主菜单单入口统一（仅保留“AI架构助手”）。

## 公共接口与类型变更
1. `excalidraw-app/components/AppMainMenu.tsx` 移除 `onOpenAIArchitectureGeneration` prop 和“AI架构生成”菜单项，仅保留“AI架构助手”。
2. `excalidraw-app/App.tsx` 删除对应回调与状态分支，仅保留统一入口调用。
3. `packages/excalidraw/components/ArchitectureAssistant.tsx` 保留 `defaultTab`，但默认从统一入口进入 `optimize`。
4. `scripts/test-architecture-fix.js` 校验口径更新为 `renderingSchemeIds` 与 `isPreparingInsert`，与现实现一致。
5. 不引入破坏性数据模型变更，`Scheme`/`generationSnapshot`/持久化字段保持兼容。

## 阶段 0：事实对齐与门禁修复（P0，必须先完成）
目标：让“文档、脚本、代码、验收结果”一致。

执行项：
1. 修正 `scripts/test-architecture-fix.js` 的旧变量校验逻辑（`renderingSchemes` -> `renderingSchemeIds`）。
2. 更新 `plan20260214.md` 阶段状态与测试口径，移除过时“15/24 文件”计数表达。
3. 更新 `AI_ARCHITECTURE_ASSISTANT.md` 中已失效的 `ai/generators` 与示例代码，改为当前 hook + `runAIStream` 架构。
4. 收敛主菜单入口：修改 `excalidraw-app/components/AppMainMenu.tsx` 与 `excalidraw-app/App.tsx`，只保留“AI架构助手”。

验收命令：
1. `yarn test:architecture`
2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`

通过标准：
1. 两条命令均通过。
2. 主菜单只出现一个 AI 主入口，功能可通过 Tab 切换覆盖原双入口能力。

## 阶段 1：`ArchitectureOptimizationDialog` 组件与逻辑拆分（P1）
目标：把巨型文件降为“编排层”，避免继续膨胀。

新增文件：
1. `packages/excalidraw/components/ArchitectureOptimizationDialog/ConfigurationWaitScreen.tsx`
2. `packages/excalidraw/components/ArchitectureOptimizationDialog/ClearSchemesConfirmDialog.tsx`
3. `packages/excalidraw/components/ArchitectureOptimizationDialog/SchemeUndoToast.tsx`
4. `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/useArchitecturePersistence.ts`
5. `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePreviewRenderer.ts`
6. `packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePlanGeneration.ts`

修改文件：
1. `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx` 仅保留状态编排与子组件装配。
2. `packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.tsx` 与 `WorkflowPage.tsx` 只保留展示逻辑。

通过标准：
1. `ArchitectureOptimizationDialog.tsx` 行数显著下降（目标 < 1200 行）。
2. 行为不变，现有 integration/test 全通过。

## 阶段 2：样式模块化与死样式清理（P1）
目标：结束单文件 4000+ 行样式维护模式。

新增样式文件：
1. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_tokens.scss`
2. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_layout.scss`
3. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_chat.scss`
4. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_workflow.scss`
5. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_preview.scss`
6. `packages/excalidraw/components/ArchitectureOptimizationDialog/styles/_overlays.scss`

改造策略：
1. `ArchitectureOptimizationDialog.scss` 仅保留 import 与极少数兼容覆盖。
2. `ArchitectureOptimizationDialog.layout.scss` 内容并入 `_layout.scss` 后删除，避免双入口样式源。

通过标准：
1. 样式目录职责清晰。
2. UI 关键路径无可见回归（对话、建议页、预览页、清空确认、未配置页）。

## 阶段 3：UX 与性能打磨（P2）
目标：补齐“感知性能”和“失败可理解性”。

执行项：
1. 在 `PreviewPage.tsx` 增加渲染中骨架与空态区分（无数据/渲染中/失败）。
2. 在 `WorkflowPage.tsx` 增加建议池空态与恢复提示入口文案强化。
3. 在 `AIArchitectureGenerationDialog` 工作台路径增加统一加载反馈，不改变业务语义。
4. 针对小屏断点整理交互（优先 <=960 和 <=600）。

通过标准：
1. 用户能明确分辨“空状态 vs 加载中 vs 错误”。
2. 移动端下主要操作可完成，不出现关键按钮遮挡。

## 阶段 4：工程化完善（P2）
目标：让该模块进入稳定可维护状态。

执行项：
1. i18n 抽取：把 AI 架构模块硬编码文案迁移到 `packages/excalidraw/locales/en.json` 与 `packages/excalidraw/locales/zh-CN.json`。
2. Atoms 测试补齐：为 `chatAtoms/schemeAtoms/workflowAtoms/uiAtoms` 增加纯逻辑测试。
3. 局部错误隔离：为 Architecture Assistant 增加局部错误边界，避免单模块异常影响全局编辑器。
4. 文档闭环：同步更新 `plan20260214.md` 与 `AI_ARCHITECTURE_ASSISTANT.md` 的状态、命令、验收清单。

通过标准：
1. 新增测试稳定通过。
2. 文案走 i18n key，不再新增硬编码中文。
3. 文档可直接作为发布验收依据。

## 回归测试与验收场景
1. 统一入口：主菜单单入口可进入助手并在 Tab 间切换两类能力。
2. 生成与更新语义：新建/更新方案跳转、快照冻结、重试校验保持正确。
3. 持久化与导入导出：聊天、建议池、方案、页面状态可恢复。
4. 预览体验：渲染中禁用插入、完成后可插入、空态/错误态提示明确。
5. 门禁：`yarn test:architecture` 与关键 `yarn test:app --watch=false ...` 通过。

## 假设与默认
1. 菜单入口采用“单入口统一”，不再保留“AI架构生成”独立菜单项。
2. 不改动现有数据存储 schema，优先做兼容性安全改造。
3. i18n 首批覆盖 `en` 与 `zh-CN`，其他语种沿用现有回退机制。
4. 不在本轮做新功能扩展，只做结构化重整与体验修复。
