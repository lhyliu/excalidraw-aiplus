# AI 架构助手（当前实现与迭代计划）

本文档用于描述 `ArchitectureOptimizationDialog` 的当前真实行为、数据模型、持久化策略与后续可执行迭代。

- 文档状态：Active
- 最后更新：2026-02-07
- 适用范围：
  - `packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`
  - `packages/excalidraw/components/ArchitectureOptimizationDialog.scss`
  - `packages/excalidraw/data/json.ts`
  - `packages/excalidraw/data/blob.ts`
  - `packages/excalidraw/data/types.ts`

---

## 1. 当前产品语义（已落地）

### 1.1 页面模式

右侧工作区由两类页面组成：

1. 固定页：`建议页`、`预览页`
2. 动态页签：`方案 1..N`

说明：建议与预览是全局工作面，方案是生成结果实体。

### 1.2 生成语义

当前有三种生成入口：

1. 建议页主按钮：`生成新方案`（`forceCreate: true`）
2. 建议页次按钮：`更新当前方案`（`forceCreate: false`，可跳过二次确认）
3. 顶部 `+`：生成新方案（`forceCreate: true`）

结论：默认主路径是“新建方案”，不会悄悄覆盖当前方案。

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

---

## 2. 数据模型（当前）

### 2.1 SuggestionPool 项

字段：`id`、`category`、`title`、`content`、`fullContent`、`selected`、`note?`、`archived?`

规则：

1. 已选建议不可删除
2. 删除动作改为“归档”（避免误删上下文）
3. 建议可搜索、可切换显示归档
4. 支持一键清空建议列表（同时清空组合与相关 UI 状态）

### 2.2 建议组合（Combination）

字段：`id`、`name`、`suggestionIds`、`createdAt`

行为：

1. 从当前勾选保存为组合
2. 组合可回放勾选状态
3. 激活组合下，勾选变化会同步回写该组合

### 2.3 方案（Scheme）

核心字段：`id`、`version`、`summary`、`mermaid`、`shortSummary`、`title?`

追溯字段：

1. `sourceCombinationId?`
2. `sourceSuggestionIds?`
3. `sourceSuggestionSnapshot?`

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

`architectureAssistantState` 包含：

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

1. 建议去重仍采用前 50 字近似匹配，存在误判概率。
2. 组合当前为“可变快照”，并非版本冻结。
3. 仓库存在大量历史 lint warning；本模块已无阻断型 lint error，但尚未完成全文件风格治理。
4. 仓库全量 typecheck 当前受 `dist/types` 历史冲突影响，不代表本功能局部逻辑异常。

## 4.2 提示词契约（已统一）

### 分析建议 Prompt

1. 固定输出 5 条建议
2. 每条格式：`- [分类] 建议标题：一句行动建议`
3. 分类白名单：`性能 / 安全 / 成本 / 扩展性 / 可靠性`
4. 每条不超过 60 个中文字符

### 方案生成 Prompt

1. 先输出 `变更总结`，固定 5 条，且带 `[分类]`
2. 再输出且仅输出 1 个 `mermaid` 代码块
3. Mermaid 必须为有效 `graph/flowchart` 语法，且为完整架构图
4. 每条变更总结不超过 50 个中文字符

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

---

## 5. 下一步可执行迭代计划

### 5.1 目标

提升一致性、可理解性、可恢复性，减少用户“切页后状态丢失/语义混淆”感知。

### 5.2 迭代项（按优先级）

1. 组合版本化（高优先）

- 现状：激活组合会被实时回写，历史不可追。
- 改进：保存组合时生成只读版本；编辑动作产生新版本。
- 验收：同名组合可回溯历史版本且可一键回放。

2. 建议去重升级（高优先）

- 现状：前 50 字去重可能误判。
- 改进：`category + normalizedTitle + simhash` 混合判重；保留“强制保留”开关。
- 验收：语义相近但意图不同建议可共存，重复项明显减少。

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
