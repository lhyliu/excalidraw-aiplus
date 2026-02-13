# AI 架构生成发布前走查脚本

日期: 2026-02-13
范围: `packages/excalidraw/components/AIArchitectureGenerationDialog*` 与 `packages/excalidraw/components/AIArchitectureGeneration/*`

## 1. 目标
- 验证“导入 -> 读懂表格 -> 待确认 -> Draft -> 校准 -> 可信现状”主链路可用。
- 验证低质量 CSV 在 AI 初识别 + 人工补充场景下可稳定产出“基础架构草图”。
- 验证关键阻断规则生效，避免误标记为 confirmed。

## 2. 测试前准备
- 启动应用并打开“AI架构生成”。
- 清空本地会话（建议打开无痕窗口）。
- 运行自动化回归:
  - `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog`
  - `yarn vitest --run packages/excalidraw/components/AIArchitectureGeneration/__tests__`

## 3. 样例 CSV 组

### A. 最小可出图数据（应可直接进入 Draft）
```csv
Host,IP,Service
web-01,10.0.0.1,checkout
web-02,10.0.0.2,checkout
```

### B. 字段名混乱（应由 AI 初步识别）
```csv
MachineName,InnerAddress,AppName,Stage
srv-a,10.1.0.10,order,prod
srv-b,10.1.0.11,order,prod
```

### C. 缺失+异常（应进入待确认与校准）
```csv
Host,IP,Service,Env
win-bastion,,ops,unknown
db-01,abc,db,prod
db-01,10.2.0.2,db,prod
```

### D. 大量环境缺失（验证批量处理）
```csv
Host,IP,Service,Env
app-01,10.3.0.1,app,
app-02,10.3.0.2,app,
app-03,10.3.0.3,app,
```

## 4. 手工验收步骤

### 4.1 导入与字段理解
1. 导入 CSV A，点击解析。
2. 进入“读懂你的表格”。
3. 验证:
- 看到业务字段名（主机名/内网IP/机器用途）。
- 仅低把握或未识别项可手工选列。
- 透视区可显示“原始列 -> AI 理解”。

### 4.2 步骤准入阻断
1. 导入 CSV B，不做关键字段确认。
2. 尝试点击“数据校准/AI优化”。
3. 验证:
- 步骤被阻断（按钮禁用或提示原因）。
- 提示语明确（例如“请先确认关键列”）。

### 4.3 待确认项处理闭环
1. 导入 CSV C。
2. 进入“待确认项（安全模式）”。
3. 验证:
- 类型卡显示“已处理 x/y”。
- 可“应用修正”。
- 可“跳过并记录原因”。
- 处理后进度即时变化。

### 4.4 专家模式保护
1. 在待确认页打开专家模式。
2. 修改若干单元格并忽略几行。
3. 验证:
- 可“撤销上一步”。
- 可“恢复进入前状态”。
- “保存并返回 AI 校准”后数据保留。

### 4.5 Draft 与 AI 洞察
1. 进入 Draft。
2. 验证:
- 即使有部分缺失，也可先出基础草图。
- 右侧 AI 洞察可“查看依据”并显示资产行。

### 4.6 校准与 confirmed 门槛
1. 进入 AI 校准。
2. 验证:
- 显示“质量门槛: 通过/未通过”。
- 未通过时展示阻断原因。
- 仅门槛通过后才显示“已标记为可信现状（confirmed）”。

## 5. 通过标准（Release Gate）
- P0 功能全部成立:
  - 步骤阻断生效
  - confirmed 受质量门槛控制
  - 安全模式处理闭环
- P1 关键体验成立:
  - 专家模式可回滚
  - AI 洞察可追溯
  - 术语业务化一致
- 自动化用例全绿（上述两条 vitest 命令）。

## 6. 缺陷记录模板
```md
- 标题:
- 严重级别: blocker/high/medium/low
- 复现步骤:
- 预期结果:
- 实际结果:
- 影响范围:
- 截图/录屏:
- 建议修复:
```

## 7. 上线建议
- 若 blocker/high > 0: 不上线，先修复后复测。
- 若仅 medium/low: 可灰度发布并跟踪。
- 首次上线建议开启使用日志采样（仅行为，不含敏感 CSV 内容）。
