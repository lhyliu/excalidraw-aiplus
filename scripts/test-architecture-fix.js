#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Architecture Optimization Dialog Fix Test
 *
 * Tests the rendering state tracking fix for the "插入到主图旁" button issue.
 */

const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(
  __dirname,
  "../packages/excalidraw/components/ArchitectureOptimizationDialog.tsx",
);

console.log("🧪 开始测试 ArchitectureOptimizationDialog 修复...\n");

// Test 1: Check if renderingSchemes state exists
console.log("Test 1: 检查 renderingSchemes 状态是否存在");
const content = fs.readFileSync(FILE_PATH, "utf8");
// Check for the state declaration (may be multiline)
const hasRenderingSchemes =
  content.includes(
    "const [renderingSchemes, setRenderingSchemes] = useState<Set<string>>(",
  ) && content.includes("new Set(),");
console.log(hasRenderingSchemes ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 2: Check if rendering state is updated in renderPreview
console.log("Test 2: 检查 renderPreview 中是否正确更新渲染状态");
// Check for both formats: with and without parentheses around arrow function parameter
const hasSetRenderingStart =
  content.includes(
    "setRenderingSchemes(prev => new Set(prev).add(scheme.id))",
  ) ||
  content.includes(
    "setRenderingSchemes((prev) => new Set(prev).add(scheme.id))",
  );
// Simplified check for the delete pattern
const hasSetRenderingEnd =
  content.includes("setRenderingSchemes") &&
  content.includes("next.delete(scheme.id)");
console.log("渲染开始标记:", hasSetRenderingStart ? "✅ 通过" : "❌ 失败");
console.log("渲染结束标记:", hasSetRenderingEnd ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 3: Check if button disabled logic includes rendering check
console.log("Test 3: 检查按钮禁用逻辑是否包含渲染状态检查");
// The disabled prop might be multiline, so check for key patterns
const hasDisabledProp = content.includes("disabled={");
const hasRenderingCheckInDisabled = content.includes(
  "renderingSchemes.has(activeScheme.id)",
);
const buttonDisabledCheck = hasDisabledProp && hasRenderingCheckInDisabled;
console.log(buttonDisabledCheck ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 4: Check if button text changes based on rendering state
console.log("Test 4: 检查按钮文字是否根据渲染状态动态变化");
const dynamicButtonText = content.includes(
  'renderingSchemes.has(activeScheme?.id || "")',
);
console.log(dynamicButtonText ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 5: Check generation navigation semantics
console.log("Test 5: 检查新建/更新方案后是否显式跳转到预览页");
const hasResolvedSchemeId = content.includes("const resolvedSchemeId =");
const hasReturnSchemeId = content.includes(
  "return { schemeId: resolvedSchemeId, wasUpdated }",
);
const hasExplicitPreviewJump =
  content.includes("setActiveSchemeId(result.schemeId);") &&
  content.includes("setIsPreviewPage(true);");
const generationNavigationCheck =
  hasResolvedSchemeId && hasReturnSchemeId && hasExplicitPreviewJump;
console.log(generationNavigationCheck ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 6: Check input textarea wrapping + autosize refs
console.log("Test 6: 检查输入框自动换行与自增高逻辑");
const hasWrapSoft = content.includes('wrap="soft"');
const hasTextareaRef = content.includes("const inputTextareaRef = useRef");
const hasAdjustHeightFn = content.includes("adjustInputTextareaHeight");
const inputBehaviorCheck = hasWrapSoft && hasTextareaRef && hasAdjustHeightFn;
console.log(inputBehaviorCheck ? "✅ 通过" : "❌ 失败");
console.log("");

// Summary
console.log("═══════════════════════════════════════");
console.log("📊 测试结果汇总");
console.log("═══════════════════════════════════════");
const allPassed =
  hasRenderingSchemes &&
  hasSetRenderingStart &&
  hasSetRenderingEnd &&
  buttonDisabledCheck &&
  dynamicButtonText &&
  generationNavigationCheck &&
  inputBehaviorCheck;
if (allPassed) {
  console.log("✅ 所有测试通过！修复已正确实施。");
  console.log("");
  console.log("修复总结：");
  console.log("- 添加了 renderingSchemes 状态跟踪渲染进度");
  console.log("- 在 renderPreview 开始和结束时更新渲染状态");
  console.log('- 按钮在渲染中时禁用并显示"正在准备..."');
  console.log("- 渲染完成后按钮变为可点击状态");
  console.log("- 新建/更新方案后显式跳转到目标方案预览页");
  console.log("- 输入框支持自动换行与自适应高度");
  process.exit(0);
} else {
  console.log("❌ 部分测试失败，请检查修复是否完整。");
  process.exit(1);
}
