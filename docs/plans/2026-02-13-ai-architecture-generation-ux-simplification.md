# AI 架构生成交互简化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前“字段识别/数据校准”改成“快速出初稿 + 仅确认不确定项”的可懂流程。

**Architecture:** 不改数据结构与路由，只重排现有 `AIArchitectureGenerationDialog` 展示层。中心区以“读懂你的表格”和“待确认事项分组卡片”为主，保留专家模式 Overlay 作为批量兜底。通过最小行为变更让用户可以从导入页直接生成初稿。

**Tech Stack:** React + TypeScript strict + Jotai + Vitest + Testing Library

---

### Task 1: 导入与字段理解改为“先出图、后细化”

**Files:**
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/FieldMappingStep.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/FieldUnderstandingPanel.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/FieldMappingStep.test.tsx`
- Create: `packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx`

**Step 1: Write failing tests**
- `FieldMappingStep.test.tsx` 断言默认提示“仅需确认不确定项”以及“查看 AI 已确认字段”入口。
- `ImportStep.test.tsx` 断言 CSV 解析后可直接点击“一键生成初稿”。

**Step 2: Verify RED**
- Run: `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/FieldMappingStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx`
- Expected: FAIL（目标文案/按钮尚不存在）

**Step 3: Write minimal implementation**
- `ImportStep` 增加 `onGenerateDraft`，在有数据时显示“一键生成初稿”。
- `FieldUnderstandingPanel` 默认仅展示低把握或未识别字段；高把握字段折叠。
- `FieldMappingStep` 增加“确认 AI 理解并继续/直接生成初稿”双路径。

**Step 4: Verify GREEN**
- Run same tests，预期 PASS。

### Task 2: 待确认页改为“类型卡片 + 批量应用”

**Files:**
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/IssuesStep.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrationTaskFlow.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/IssuesStep.test.tsx`

**Step 1: Write failing test**
- `IssuesStep.test.tsx` 断言显示“待确认事项 (N 类)”并支持“确认并应用 (count)”。

**Step 2: Verify RED**
- Run: `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/IssuesStep.test.tsx`
- Expected: FAIL（当前仍是逐行输入卡片）

**Step 3: Write minimal implementation**
- 按问题类型显示卡片，给出 AI 分析与建议值。
- 为可建议类型增加批量应用按钮。
- 行级内容改为“预览涉及主机”展开区，保留专家模式入口。

**Step 4: Verify GREEN**
- Run same test，预期 PASS。

### Task 3: 全局文案与摘要引导

**Files:**
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/CalibrationStepper.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog/AiUnderstandingPanel.tsx`
- Modify: `packages/excalidraw/components/AIArchitectureGenerationDialog.scss`

**Step 1: Write failing assertions (已有覆盖)**
- 通过现有对话级测试验证关键入口仍可导航。

**Step 2: Write minimal implementation**
- 左侧步骤文案改为业务化命名（导入表格/读懂表格/待确认项/初步架构图/可信现状）。
- 右侧摘要顶部改为“下一步建议”。
- 样式补充：卡片优先级标签、批量操作区、折叠预览区。

**Step 3: Verify**
- Run: `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog`
- Expected: 全部 PASS。
