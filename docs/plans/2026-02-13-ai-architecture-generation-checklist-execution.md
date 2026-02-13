# AI 架构生成联调清单执行记录（2026-02-13）

## 执行命令

```bash
yarn vitest --run packages/excalidraw/components/ArchitectureOptimizationDialog/importWorkflow packages/excalidraw/components/AIArchitectureGenerationDialog
```

结果：
- Test Files: `15 passed`
- Tests: `21 passed`

## 清单结果

### A. 自动验证通过

1. CSV 导入与解析链路可用（`parseCsv`）。
2. 字段推断、字段映射校验可用（`fieldInference`、`fieldMapping`）。
3. 标准化支持 `ignoredRows`、`edits` 覆盖（`normalizeVmRows`）。
4. Issues 检测规则可用（缺失、格式、重复、环境异常）。
5. 服务分组推断可用（服务名优先，主机名前缀回退）。
6. Draft 阶段可触发命名建议并手动应用（不会自动写事实）。
7. Calibrate 阶段可通过任务完成推进到 `confirmed`。
8. 会话恢复可用（step、mode、draft filter、naming suggestions）。

### B. 仍需人工点检

1. 菜单入口与顶部入口交互流畅度（视觉与可用性）。
2. 大 CSV 数据量下 UI 响应（滚动/编辑/切换步骤体验）。
3. 深色/浅色主题下可读性与对比度。
4. 浏览器刷新后的跨步骤继续操作体验（非测试环境真实 localStorage）。

## 备注

- 当前自动化覆盖以逻辑与组件行为为主。
- 若进入发布前阶段，建议补 1 条真实浏览器 E2E（Playwright 或 Cypress）覆盖“导入到 confirmed”主流程。

