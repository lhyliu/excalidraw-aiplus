# AI 架构生成发布前走查脚本（按当前 UI 更新）

日期：2026-02-13  
范围：`packages/excalidraw/components/AIArchitectureGenerationDialog*` 与 `packages/excalidraw/components/AIArchitectureGeneration/*`

## 1. 目标

1. 验证“数据工作台 -> 架构图视图 -> 可信现状”主链路。
2. 验证低质量 CSV 在 AI 初识别 + 人工确认场景下可稳定产出业务草图。
3. 验证质量门禁对 `confirmed` 生效。

## 2. 测试前准备

1. 启动应用并打开 `AI架构生成`。
2. 建议使用无痕窗口，避免历史会话影响结果。
3. 运行自动化回归：
- `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/GuidedWorkspaceStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/ExpertEditOverlay.test.tsx`
- `yarn vitest --run packages/excalidraw/components/AIArchitectureGenerationDialog/ImportStep.test.tsx packages/excalidraw/components/AIArchitectureGenerationDialog/DraftStep.test.tsx`

## 3. 样例 CSV 组

### A. 最小可出图数据
```csv
Host,IP,Service
web-01,10.0.0.1,checkout
web-02,10.0.0.2,checkout
```

### B. 字段名混乱
```csv
MachineName,InnerAddress,AppName,Stage
srv-a,10.1.0.10,order,prod
srv-b,10.1.0.11,order,prod
```

### C. 缺失+异常
```csv
Host,IP,Service,Env
win-bastion,,ops,unknown
db-01,abc,db,prod
db-01,10.2.0.2,db,prod
```

### D. 服务名缺失较多
```csv
Host,IP,Service,Env
app-01,10.3.0.1,,production
app-02,10.3.0.2,,production
app-03,10.3.0.3,,production
```

## 4. 手工验收步骤

### 4.1 数据工作台基础可用
1. 导入 CSV B。
2. 验证中心表格可编辑，右侧抽屉收起态只有一个“展开引导”入口。
3. 展开抽屉后，验证存在：
- `读懂你的表格`
- `待确认事项`
- `进入 Draft 预览`

### 4.2 服务名称 AI 识别入口
1. 导入 CSV D。
2. 验证“服务名称（组件用途）”表头存在 `AI识别` 小按钮。
3. 点击后验证：
- 出现识别中状态
- 识别结果写回 serviceName
- 新填充值有临时高亮提示

### 4.3 行级快速识别与手工修正
1. 在服务名仍为空的行点击 `Row x AI识别`。
2. 验证单行识别成功后仅影响对应 row。
3. 手工修改若干单元格，验证 `issues` 统计与引导内容同步变化。

### 4.4 批量编辑工具（Overlay）
1. 点击 `打开批量编辑工具`。
2. 验证支持：
- 范围（已勾选/全部）
- 覆盖策略（仅空值/覆盖已有值）
- 批量填充/忽略所选行/撤销/恢复
3. 点击“保存并返回校准工作台”，验证变更被保留。

### 4.5 架构图视图（按业务范围）
1. 点击 `进入 Draft 预览`。
2. 验证流程：
- 可选择“当前业务范围”
- 支持 `AI 重新识别范围`
- 支持 `AI 分析分层`
- 可生成“当前业务架构图”

### 4.6 可信现状门禁
1. 进入 `可信现状`。
2. 验证：
- 有未满足条件时不能误标记 `confirmed`
- 满足门槛后可进入 confirmed 状态

## 5. 通过标准（Release Gate）

1. P0：
- 工作台链路闭环可用
- 表头 AI 识别可用
- 批量编辑 Overlay 可回滚
- confirmed 受门禁控制
2. P1：
- 业务范围识别与分层建议可用
- AI 生成架构图可用
3. 自动化用例全绿（第2节命令）。

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

1. blocker/high > 0：不发布。
2. 仅 medium/low：可灰度发布并跟踪。
3. 首次上线建议开启行为日志采样（不记录敏感 CSV 内容）。
