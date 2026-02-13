# AI 架构助手（当前实现与迭代计划）

本文档用于描述 `ArchitectureOptimizationDialog` 的当前真实行为、数据模型、持久化策略与后续可执行迭代。

- 文档状态：Active
- 最后更新：2026-02-13
- 适用范围：
  - `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
  - `packages/excalidraw/components/ArchitectureOptimizationDialog.scss`
  - `packages/excalidraw/components/AIArchitectureGeneration/` (重构后的模块)
  - `packages/excalidraw/components/AIArchitectureGenerationDialog.tsx`
  - `packages/excalidraw/components/AIArchitectureGenerationDialog/*`
  - `packages/excalidraw/data/json.ts`
  - `packages/excalidraw/data/blob.ts`
  - `packages/excalidraw/data/types.ts`

## 更新记录（v2 整改验收，2026-02-13）

本轮整改目标已完成，关键变更如下：

1. 主菜单 AI 入口收敛为单入口（仅保留“AI 架构助手”）。
2. `ArchitectureOptimizationDialog` 拆分为编排层 + hooks/子组件，主文件行数降至 <1200。
3. 样式改为模块化分层（`styles/_tokens|_layout|_chat|_workflow|_preview|_overlays.scss`）。
4. 预览与工作流 UX 增强（渲染中骨架、空态区分、建议恢复入口、工作台加载反馈）。
5. 新增 Architecture Assistant 局部错误边界，避免单模块异常扩散。
6. Atoms 纯逻辑测试补齐（`chat/scheme/workflow/ui`）。
7. 本轮新增/改动文案已切换 i18n key，并补齐 `en` / `zh-CN` 键值。

验收命令（已通过）：

1. `yarn test:architecture`
2. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/ArchitectureOptimizationDialog.integration.test.ts packages/excalidraw/components/AIArchitectureGenerationDialog/AIArchitectureGenerationDialog.session.test.tsx`
3. `yarn test:app --watch=false packages/excalidraw/components/ArchitectureOptimizationDialog/atoms/atoms.test.ts`
4. `yarn test:app --watch=false`

## 0. AI架构生成模块（重构完成）

### 0.1 模块结构

```
packages/excalidraw/components/AIArchitectureGeneration/
├── types/           # 统一类型定义
├── core/            # 核心逻辑
│   ├── data/        # CSV解析、数据标准化
│   ├── engine/      # 工作流引擎
│   ├── inference/   # 字段推断、服务分组
│   └── validation/  # 问题检测
├── state/           # 状态管理 (Jotai)
│   ├── atoms/       # 基础状态
│   ├── selectors/   # 派生状态
│   └── persistence/ # 持久化与迁移
├── ai/              # AI能力导出（兼容层，具体调用在 Dialog hooks）
├── compat/          # 向后兼容层
├── ui/              # UI组件
├── steps/           # 步骤组件
└── utils/           # 工具函数
```

### 0.2 核心特性

- **声明式工作流引擎**: 支持步骤验证、生命周期钩子、状态订阅
- **分层状态管理**: 4层架构（原始数据→编辑→派生→UI）
- **AI Hook 调用模式**: AI 能力通过 `AIArchitectureGenerationDialog/hooks/*` + `runAIStream` 提供
- **向后兼容**: 自动数据迁移，路径映射
- **完整TypeScript支持**: 类型安全

### 0.3 快速开始

```typescript
// 使用工作流引擎
import { createDefaultWorkflowEngine } from "./core/engine";
const engine = createDefaultWorkflowEngine();

// 使用 AI Hook（示例）
import { useServiceNamingSuggestion } from "./hooks/useServiceNamingSuggestion";
const { suggest } = useServiceNamingSuggestion();
const result = await suggest({ hostname: "web-01", serviceName: "nginx" });

// 使用状态管理
import { useSourceData } from "./state";
const { parsedCsv, setParsedCsv } = useSourceData();
```

### 0.4 架构助手统一入口（ArchitectureAssistant）
`ArchitectureAssistant` 是当前 AI 功能的统一容器，通过顶部悬浮 Tab 在以下两个子模块间切换：

1.  **画布优化 (ArchitectureOptimizationDialog)**: 针对已有架构图的分析、优化建议与方案生成。
2.  **CSV 生成 (AIArchitectureGenerationDialog)**: 从 CMDB/Excel 数据源生成架构图。

### 0.5 AI架构生成模块（CSV 生成）

`AIArchitectureGenerationDialog` (CSV 生成模式) 已统一为 3 段主流程：

1. `数据工作台（workspace）`
2. `架构图视图（draft）`
3. `可信现状（calibrate）`

其中历史步骤 `import / mapping / issues` 仍被兼容，但会自动合并到 `workspace`。

#### 数据工作台（workspace）

1. 中心区域为 AG Grid 原生表格（`SharedAgGrid` 统一封装），支持原生单元格编辑与分页。
2. `服务名称（组件用途）` 列表头内置 `AI识别` 小按钮，可批量填充缺失的服务用途。
3. 空服务名行保留按行触发入口（`Row x AI识别`），用于单条补录。
4. 右侧改为浮层抽屉式“AI 引导修正”，收起态只有一个入口，避免占用表格主体空间。
5. 批量编辑能力收敛为单一 Overlay（Table Tools），不再单独占步骤页签。

#### 架构图视图（draft）

1. 每次只处理一个业务范围。
2. 业务范围优先由 LLM 推断（失败时回退本地分组策略）。
3. 可请求 AI 业务分层建议并手工拖拽调整后再生成该业务架构草图。

#### 可信现状（calibrate）

1. 继续沿用任务门禁与 `confirmed` 状态控制。
2. 未满足关键门槛时，不允许误标记为可信现状。

#### LLM 调用约束（当前）

仅复用仓库既有 AI 服务与流式调用，能力集中在“建议”而非“事实落库”：

1. 字段识别建议（列名理解）
2. 服务命名/服务语义建议
3. 业务范围建议
4. 业务分层与架构草图建议

AI 输出不会直接写入最终事实，必须经过用户确认或显式应用。


---

## 1. 当前产品语义（已落地）

### 1.1 页面模式

右侧工作区由两类页面组成：

1. 固定页：`建议页`、`预览页`
2. 动态页签：`方案 1..N`

说明：建议与预览是全局工作面，方案是生成结果实体。

### 1.2 生成语义（已统一）

当前有三种入口，但底层策略统一为同一执行链路：

1. 建议页主按钮：`生成新方案`（`forceCreate: true`）
2. 建议页次按钮：`更新当前方案`（`forceCreate: false`，可跳过二次确认）
3. 顶部 `+`：生成新方案（`forceCreate: true`）

结论：`生成方案/生成新方案/更新当前方案` 复用同一策略，仅 `create/update` 模式不同；默认主路径是“新建方案”，不会悄悄覆盖当前方案。

跳转约束：

1. 新建方案后，自动切换到“新方案”并进入预览页
2. 更新方案后，保持“当前方案”并进入预览页

### 1.3 对比语义

`对比模式` 始终为：

- 左侧：当前方案预览
- 右侧：原架构图（由当前画布导出 SVG）

不在多方案间做两两对比。

### 1.4 对话与建议语义（新增）

1. AI 对话消息拆分为两段：

- `AI思考`（reasoning，完成后默认折叠，可手动展开）
- `正式答复`（content，直接参与建议抽取）

2. 建议池清空后，允许从“最近一次 AI 结论”一键恢复建议（仍走同一去重规则）。
3. 预览页新增 `AI方案总结` 区域，可单独“重新生成总结”，不改 Mermaid 图。
4. 建议流按分类分组展示，并显示分组计数与全局统计（共X条/已选Y条）。

---

## 2. 数据模型（当前）

### 2.1 SuggestionPool 项

字段：`id`、`category`、`title`、`content`、`fullContent`、`selected`、`note?`、`archived?`

规则（当前）：

1. 已选建议不可删除
2. 删除动作改为“归档”（避免误删上下文）
3. 建议可搜索、可切换显示归档
4. 支持一键清空建议列表（不再连带清空方案）
5. 建议去重升级为规范化键：`category + normalizedContent`，并在单次提取内二次去重

### 2.2 建议组合（Combination，已降级为历史数据）

字段：`id`、`name`、`suggestionIds`、`createdAt`

行为说明：

1. 历史方案仍保留 `sourceCombinationId` 以保证兼容追溯
2. 建议页 UI 已移除“保存组合/清空组合”入口，不再作为主要交互路径
3. 组合相关数据仅作兼容保留，后续可按迁移计划逐步下线

### 2.3 方案（Scheme）

核心字段：`id`、`version`、`summary`、`mermaid`、`shortSummary`、`title?`

追溯字段：

1. `sourceCombinationId?`
2. `sourceSuggestionIds?`
3. `sourceSuggestionSnapshot?`
4. `generationSnapshot?`（生成瞬间冻结的已选建议、风格、来源方案与时间戳）

用途：当组合被删除或建议池变化后，仍可依赖 `sourceSuggestionSnapshot` 恢复生成上下文。

---

## 3. 持久化与导入导出

### 3.1 本地存储作用域

架构助手数据按文件名作用域隔离：

- key 形态：`<baseKey>::<scope>`
- scope 来源：`appState.name`（空值回退 `default`）

兼容策略：读取时先读 scoped key，再回退旧全局 key（迁移兼容）。

### 3.2 存储内容

1. `architectureChatHistory`
2. `architectureSchemes`
3. `architectureAssistantState`

`architectureAssistantState` 仍兼容包含：

- `suggestionPool`
- `suggestionCombinations`
- `activeCombinationId`
- `architectureStyle`
- `skipUpdateConfirm`
- `suggestionSearchKeyword`
- `showArchivedSuggestions`
- `draftInput`
- `activeSchemeId`
- `isPreviewPage`
- `isCompareMode`

说明：

1. 对话消息中的 `reasoning` 当前不做本地持久化，仅用于会话期展示（避免存储膨胀）。

### 3.3 文件导出/导入

`保存到文件` 时会写入：

1. `architectureChatHistory`
2. `architectureSchemes`
3. `architectureAssistantState`

导入 `.excalidraw` 时会恢复以上全部字段。

---

## 4. 当前已知边界

1. 历史组合数据仍保留在状态模型中，后续需做迁移清理（UI 已移除入口）。
2. Mermaid 渲染仍可能受模型输出波动影响，已通过 sanitize + fallback + 纠偏重试降低失败率。
3. 仓库存在大量历史 lint warning；本模块已无阻断型 lint error，但尚未完成全文件风格治理。
4. 仓库全量 typecheck 当前受 `dist/types` 历史冲突影响，不代表本功能局部逻辑异常。

## 4.2 提示词契约（已统一）

### 分析建议 Prompt

1. 固定输出 5 条建议
2. 每条格式：`- [分类] 建议标题：一句行动建议`
3. 分类白名单：`性能 / 安全 / 成本 / 扩展性 / 可靠性`
4. 每条不超过 60 个中文字符

### 方案生成 Prompt

1. 优先输出结构化 JSON：`changes[] + mermaid + assumptions[]`
2. 若无法稳定输出 JSON，回退为“变更总结 + 1 个 mermaid 代码块”
3. 若输入包含“已选建议”，变更总结条数必须与已选建议数量一致（不设上限）
4. Mermaid 必须为有效 `graph/flowchart` 语法，且为完整架构图
5. 每条变更总结不超过 50 个中文字符
6. 强约束保持原图视觉与结构风格一致，仅做最小必要调整

### 方案生成校验（新增）

1. Mermaid 不能为空，且语法必须可识别为 `graph/flowchart`
2. 变更总结必须为 `[分类]` 列表，分类仅允许：`性能 / 安全 / 成本 / 扩展性 / 可靠性`
3. 若存在 `generationSnapshot`，总结条数必须与快照中的已选建议条数一致
4. 首次输出不满足校验时，自动触发一次纠偏重试；仍失败则提示具体原因

### 预览总结重写 Prompt

1. 固定输出 5 条要点
2. 每条格式：`- [分类] 一句话行动建议`
3. 不输出 Mermaid、不输出长段落

---

## 4.1 输入区交互约束（已落地）

1. 输入框自动换行，不出现左右滚动
2. 随内容增加向上扩展
3. 最大高度为左侧对话面板的 50%
4. 超过上限后切换为纵向滚动
5. placeholder 支持换行，展示为灰色弱提示

## 4.3 清空与撤回交互（已落地）

1. `清空方案` 使用应用内统一确认弹层（非浏览器原生 confirm）。
2. 清空方案时支持勾选：
- 是否同时清空已选建议
- 是否同时清空建议项目（建议流）
3. 默认仅清空方案，保留建议流与已选建议。
4. 删除单个方案支持撤回，撤回窗口延长为 12 秒。
5. 撤回提示条（toast）样式统一并带进度条倒计时。

---

## 5. 下一步可执行迭代计划

### 5.1 目标

提升一致性、可理解性、可恢复性，减少用户“切页后状态丢失/语义混淆”感知。

### 5.2 迭代项（按优先级）

1. 历史组合数据迁移清理（高优先）

- 现状：组合 UI 已下线，但状态模型仍保留兼容字段。
- 改进：设计迁移脚本，将历史组合引用折叠为 `generationSnapshot/sourceSuggestionSnapshot`。
- 验收：去除运行时组合依赖后不影响历史方案回放与导入导出兼容。

2. 建议去重精度继续优化（中优先）

- 现状：已采用 `category + normalizedContent` 去重，仍有语义近似误判可能。
- 改进：引入轻量语义相似度阈值与人工“保留重复”开关。
- 验收：近义句误合并率下降，重复项可控。

3. 预览页空态与恢复提示（中优先）

- 现状：切页后部分状态恢复失败时反馈不够明确。
- 改进：增加“预览缓存状态/重建中/恢复失败原因”提示层。
- 验收：用户能明确知道是无数据、渲染中还是失败。

4. 导出自检（中优先）

- 现状：依赖导入后人工确认。
- 改进：导出前执行字段完整性校验并记录日志（仅开发态）。
- 验收：缺字段时阻止保存并给出明确错误。

---

## 6. 回归验收清单（可直接执行）

一键脚本：

- `yarn test:architecture`

1. 建议持久化

- 对话 2 轮生成建议并勾选 2 条
- 关闭助手再打开
- 期望：建议池、勾选、搜索词、显示归档开关均保留

2. 组合与方案追溯

- 保存组合 A，生成方案 1
- 更改勾选保存组合 B，生成方案 2
- 在方案 1/2 之间切换
- 期望：勾选可按来源正确回放；组合不存在时可由 snapshot 恢复

3. 预览与对比

- 方案生成后自动进入预览可见图
- 切回建议页再回预览页仍可见
- 开启对比模式可见原架构图

4. 导出导入完整性

- 执行“保存到文件”
- 重新打开该文件
- 期望：聊天、建议池、组合、方案、页面状态全部恢复

5. 建议恢复能力（新增）

- 清空建议池后，点击“恢复上次建议”
- 期望：基于最近一次 AI 结论恢复建议并提示恢复数量

6. 思考区展示（新增）

- 发起一次 AI 对话

---

## 7. 端到端人工验证清单（决策优先链路）

说明：以下清单用于真实 UI 验收，验证“用户选择什么，AI就只基于什么生成”。

### Case A：只选 1 条建议生成新方案

1. 在建议池仅勾选 1 条建议（例如性能项）
2. 点击 `生成新方案`
3. 期望：
- 生成前确认区显示“已选 1 项”
- 方案总结条数为 1 条（与已选数量一致）
- 预览页“已选建议覆盖率”显示 `已体现 1/1` 或明确 `未体现`
- 不出现明显未勾选建议的新增条目

### Case B：选 2 条建议更新当前方案

1. 先有一个已有方案
2. 仅勾选 2 条建议，点击 `更新当前方案`
3. 期望：
- 更新后停留在当前方案并进入预览页
- 总结条数为 2 条
- 覆盖率显示 `X/2`
- 若模型首次输出不合规，自动纠偏后得到合规结果；仍失败则提示具体原因

### Case C：勾选变化不影响进行中的生成（快照冻结）

1. 勾选 A、B 后点击生成
2. 生成过程中切换勾选为 C
3. 期望：
- 本次结果仍基于 A、B（非 C）
- 方案追溯字段中保留生成时快照（`generationSnapshot`）

### Case D：持久化与导入导出

1. 生成至少 1 个方案并关闭重开助手
2. 保存 `.excalidraw` 文件后重新导入
3. 期望：
- 建议池/组合/方案/页面状态恢复
- 方案追溯信息（含快照）存在

### 验收记录模板

- 日期：
- 验收人：
- 用例结果：
  - Case A：通过 / 失败（备注）
  - Case B：通过 / 失败（备注）
  - Case C：通过 / 失败（备注）
  - Case D：通过 / 失败（备注）
- 期望：生成中“AI 思考”默认展开，生成完成后默认折叠，正式答复独立展示

7. Prompt 契约测试（新增）

- 执行 `yarn test:app packages/excalidraw/services/aiService.test.ts --run`
- 期望：关键约束词（5 条分类总结、单 mermaid 代码块）存在

---

## 7. 维护约定

1. 调整生成语义时同步更新“1.2 生成语义”。
2. 调整导入导出字段时同步更新“3.2 存储内容”。
3. 调整对象模型时同步更新“2 数据模型”。
4. 每次迭代更新顶部日期与“5 下一步计划”状态。
5. 修改 AI 提示词时，同步更新“4.2 提示词契约”并保持单测通过。

---

## 8. 分支与发布策略（已确定）

### 8.1 分支职责

1. `master`：正式版分支，只保留可发布、已验证的稳定代码。
2. `dev`：开发集成分支，日常功能开发与联调在此进行。
3. `feat/*`、`fix/*`：从 `dev` 拉出，完成后通过 PR 合并回 `dev`。

### 8.2 发布节奏

1. 日常开发：`feat/* -> dev`。
2. 稳定验收：在 `dev` 完成回归（至少执行 `yarn test:architecture`，必要时执行 `yarn test:all`）。
3. 正式发布：`dev -> master` 发起 PR，审核通过后合并。
4. 打版标记：在 `master` 打语义化标签（例如 `v1.1.0`、`v1.2.0`）。

### 8.3 热修复策略

1. 线上问题从 `master` 拉 `hotfix/*` 修复并回合 `master`。
2. 同一修复必须同步回合到 `dev`，避免分支漂移。

### 8.4 保护建议

1. `master` 开启分支保护：必须 PR、至少 1 个 review、CI 通过后方可合并。
2. `dev` 建议开启基础保护：禁止直接 push，统一走 PR。
