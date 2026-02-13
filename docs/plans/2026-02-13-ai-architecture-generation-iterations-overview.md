# AI 架构生成 Iteration A-D 总览

## 1. 范围与入口

- 功能入口：
  - 主菜单：`AI架构生成`
  - 顶部按钮：`AI架构生成`
- 入口挂载文件：
  - `excalidraw-app/components/AppMainMenu.tsx`
  - `excalidraw-app/App.tsx`
- 主容器：
  - `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`

## 2. 端到端流程（当前实现）

`import -> mapping -> issues -> advanced -> draft -> calibrate`

- `import`：CSV 导入与解析
- `mapping`：字段推断 + 字段映射 + aliasStore 记忆
- `issues`：默认安全修正（Issues 卡片）
- `advanced`：高级修正（单元格编辑、批量填充、多行忽略）
- `draft`：服务分组预览 + VM 表格 + AI 命名建议入口
- `calibrate`：任务驱动校准，阻塞任务完成后进入 `confirmed`

## 3. 数据流与状态流

核心数据层（Jotai + atomWithStorage）位于：
- `packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow/state.ts`

关键 atoms：
- `importedCsvAtom`：原始 CSV 结构（headers + rows）
- `fieldMappingAtom`：当前字段映射
- `aliasStoreAtom`：字段别名记忆
- `editsAtom`：表格/卡片修正覆盖
- `ignoredRowsAtom`：忽略行
- `normalizedVmRowsAtom`：标准化 VM 行（由 raw + mapping + edits + ignoredRows 派生）
- `issuesAtom`：问题检测结果
- `serviceGroupsAtom`：服务分组推断结果
- `calibrationStateAtom`：校准任务清单与状态
- `confidenceStateAtom`：`calibrating | confirmed`
- `completedCalibrationTaskIdsAtom`：已完成校准任务持久化

对话框会话持久化（新增）：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/sessionState.ts`
- 持久化字段：
  - `step`
  - `mode`
  - `draftFilter`
  - `namingSuggestions`

状态推进逻辑：
1. `importedCsvAtom` 更新后，触发推断与标准化链路。
2. `mapping/edits/ignoredRows` 变更会重新计算 `normalizedVmRowsAtom`。
3. `issuesAtom` 与 `serviceGroupsAtom` 共同生成校准任务。
4. `markCalibrationTaskDoneAtom` 写入任务完成状态。
5. 所有阻塞任务完成后 `confidenceStateAtom = confirmed`。

## 4. Iteration 对应实现

### Iteration A（数据与规则）

目录：
- `packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow/`

能力：
- `parseCsv`
- `inferFields`
- `buildInitialFieldMapping` / `validateFieldMapping`
- `normalizeVmRows`
- `detectIssues`
- `inferServiceGroups`
- `buildCalibrationState`

### Iteration B（导入与修正 UI）

目录：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/`

能力：
- `ImportStep.tsx`
- `FieldMappingStep.tsx`
- `IssuesStep.tsx`
- `AdvancedTableStep.tsx`

### Iteration C（draft 与 AI 命名建议）

目录：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.tsx`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/hooks/useServiceNamingSuggestion.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/prompt/serviceNamingPrompt.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/utils/draftProjection.ts`

LLM 约束：
- 仅复用 `packages/excalidraw/services/aiService.ts` 的 `runAIStream`
- 命名建议不会自动写入事实，需用户手动“应用”

### Iteration D（calibrate 与 confirmed）

目录：
- `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrateStep.tsx`
- `packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow/state.ts`

能力：
- 任务驱动校准
- 阻塞任务完成后自动标记 `confirmed`

## 5. 当前测试覆盖

已覆盖目录：
- `packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow/*.test.ts`
- `packages/excalidraw/components/AIArchitectureGenerationDialog/**/*.test.ts?(x)`

已验证命令：
- `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog`
- `yarn vitest --run packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow packages/excalidraw/components/AIArchitectureGenerationDialog`

## 6. 联调检查清单

1. 从主菜单和顶部按钮都能打开 `AI架构生成`。
2. 导入 CSV 后可自动推断字段；映射保存后 aliasStore 记忆生效。
3. Issues 修复与 Advanced 编辑能正确写入 `editsAtom`。
4. `ignoredRows` 生效后，标准化行和问题列表同步变化。
5. Draft 中 AI 命名建议需手动应用，应用后仅写编辑覆盖。
6. Calibrate 中完成全部阻塞任务后显示 `confirmed`。

联调执行记录：
- `docs/plans/2026-02-13-ai-architecture-generation-checklist-execution.md`
