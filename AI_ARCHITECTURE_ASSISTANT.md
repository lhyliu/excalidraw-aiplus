# AI 架构助手（当前实现与迭代计划）

本文档用于描述 `ArchitectureOptimizationDialog` 的当前真实行为、数据模型、持久化策略与后续可执行迭代。

- 文档状态：Active
- 最后更新：2026-02-13
- 适用范围：
  - `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
  - `packages/excalidraw/components/ArchitectureOptimizationDialog.scss`
  - `packages/excalidraw/components/AIArchitectureGeneration/` (重构后的模块)
  - `packages/excalidraw/data/json.ts`
  - `packages/excalidraw/data/blob.ts`
  - `packages/excalidraw/data/types.ts`

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
├── ai/              # AI能力
│   ├── generators/  # AI生成器
│   └── prompts/     # 提示词模板
├── compat/          # 向后兼容层
├── ui/              # UI组件
├── steps/           # 步骤组件
└── utils/           # 工具函数
```

### 0.2 核心特性

- **声明式工作流引擎**: 支持步骤验证、生命周期钩子、状态订阅
- **分层状态管理**: 4层架构（原始数据→编辑→派生→UI）
- **AI生成器模式**: 可扩展的AI能力（服务命名、架构图、数据修复建议）
- **向后兼容**: 自动数据迁移，路径映射
- **完整TypeScript支持**: 类型安全

### 0.3 快速开始

```typescript
// 使用工作流引擎
import { createDefaultWorkflowEngine } from "./core/engine";
const engine = createDefaultWorkflowEngine();

// 使用AI生成器
import { ServiceNamingGenerator } from "./ai/generators";
const generator = new ServiceNamingGenerator(aiService);
const result = await generator.generate({ hostname: "web-01", serviceName: "nginx" });

// 使用状态管理
import { useSourceData } from "./state";
const { parsedCsv, setParsedCsv } = useSourceData();
```


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
