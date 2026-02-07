# Bug 修复记录: "插入到主图旁" 按钮无效

## 问题描述

当在 AI 架构助手中点击"方案 2"（或任何非首个方案）后，点击"插入到主图旁"按钮无效。

## 根本原因

这是一个**数据竞态条件（Race Condition）**问题：

1. 当切换到新方案时，触发 `renderPreview` 异步渲染
2. `renderPreview` 调用 `convertMermaidToExcalidraw` 将 Mermaid 代码转换为 Excalidraw 元素
3. **但在渲染完成前**，`dataRef.current.elements` 是空的
4. 用户点击"插入到主图旁"按钮时，`insertSchemeToCanvas` 函数检测到空数据，直接 `return`

## 修复方案

### 1. 添加渲染状态跟踪

```typescript
const [renderingSchemes, setRenderingSchemes] = useState<Set<string>>(
  new Set(),
);
```

### 2. 在 `renderPreview` 中标记渲染状态

```typescript
// 渲染开始时标记
setRenderingSchemes(prev => new Set(prev).add(scheme.id));

try {
  await convertMermaidToExcalidraw({...});
} finally {
  // 渲染完成后清除标记
  setRenderingSchemes(prev => {
    const next = new Set(prev);
    next.delete(scheme.id);
    return next;
  });
}
```

### 3. 按钮禁用逻辑和文字动态变化

```typescript
<button disabled={!activeScheme || renderingSchemes.has(activeScheme.id)}>
  {renderingSchemes.has(activeScheme?.id || "")
    ? "正在准备..."
    : "插入到主图旁"}
</button>
```

## 测试用例

### 基础功能测试

- [ ] 生成第一个优化方案，验证"插入到主图旁"按钮可用
- [ ] 点击按钮，验证正确插入到画布

### 多方案切换测试（关键）

- [ ] 生成第二个优化方案
- [ ] 切换到"方案 2"标签
- [ ] **关键验证**：按钮应显示"正在准备..."且禁用
- [ ] 等待预览渲染完成
- [ ] **关键验证**：按钮应恢复为"插入到主图旁"且可用
- [ ] 点击按钮，验证正确插入方案 2

### 快速切换测试

- [ ] 快速在方案 1 和方案 2 之间切换
- [ ] 验证按钮状态是否正确同步

## 文件修改

修改文件：`packages/excalidraw/components/ArchitectureOptimizationDialog.tsx`

主要改动：

1. 新增 `renderingSchemes` 状态（第 135 行）
2. 在 `renderPreview` 函数中添加渲染状态标记（第 259-275 行）
3. 更新按钮禁用逻辑和动态文字（第 1001-1006 行）

## 验证方法

运行测试脚本：

```bash
node scripts/test-architecture-fix.js
```

预期输出：所有测试通过 ✅
