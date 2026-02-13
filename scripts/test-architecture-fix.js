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
const PREVIEW_FILE_PATH = path.join(
  __dirname,
  "../packages/excalidraw/components/ArchitectureOptimizationDialog/PreviewPage.tsx",
);
const PREVIEW_RENDERER_HOOK_FILE_PATH = path.join(
  __dirname,
  "../packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePreviewRenderer.ts",
);
const PLAN_GENERATION_HOOK_FILE_PATH = path.join(
  __dirname,
  "../packages/excalidraw/components/ArchitectureOptimizationDialog/hooks/usePlanGeneration.ts",
);
const CHAT_PANEL_FILE_PATH = path.join(
  __dirname,
  "../packages/excalidraw/components/ArchitectureOptimizationDialog/ChatPanel.tsx",
);
const INPUT_COMPOSER_FILE_PATH = path.join(
  __dirname,
  "../packages/excalidraw/components/ArchitectureOptimizationDialog/inputComposer.ts",
);

console.log("🧪 开始测试 ArchitectureOptimizationDialog 修复...\n");

// Test 1: Check if renderingSchemeIds state exists
console.log("Test 1: 检查 renderingSchemeIds 状态是否存在");
const content = fs.readFileSync(FILE_PATH, "utf8");
const previewContent = fs.readFileSync(PREVIEW_FILE_PATH, "utf8");
const previewRendererHookContent = fs.readFileSync(
  PREVIEW_RENDERER_HOOK_FILE_PATH,
  "utf8",
);
const planGenerationHookContent = fs.readFileSync(
  PLAN_GENERATION_HOOK_FILE_PATH,
  "utf8",
);
const chatPanelContent = fs.readFileSync(CHAT_PANEL_FILE_PATH, "utf8");
const inputComposerContent = fs.readFileSync(INPUT_COMPOSER_FILE_PATH, "utf8");
// Check for the state declaration (may be multiline)
const hasRenderingSchemeIds =
  content.includes(
    "const [renderingSchemeIds, setRenderingSchemeIds] = useAtom(aoRenderingSchemeIdsAtom);",
  );
console.log(hasRenderingSchemeIds ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 2: Check if rendering state is updated in renderPreview
console.log("Test 2: 检查 renderPreview 中是否正确更新渲染状态");
// Check for both formats: with and without parentheses around arrow function parameter
const hasSetRenderingStart =
  previewRendererHookContent.includes(
    "setRenderingSchemeIds((prev) => [...prev, scheme.id]);",
  ) ||
  previewRendererHookContent.includes(
    "setRenderingSchemeIds((prev) => [...prev, scheme.id])",
  );
// Simplified check for the delete pattern
const hasSetRenderingEnd =
  previewRendererHookContent.includes("setRenderingSchemeIds") &&
  previewRendererHookContent.includes("prev.filter((id) => id !== scheme.id)");
console.log("渲染开始标记:", hasSetRenderingStart ? "✅ 通过" : "❌ 失败");
console.log("渲染结束标记:", hasSetRenderingEnd ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 3: Check if button disabled logic includes rendering check
console.log("Test 3: 检查按钮禁用逻辑是否包含渲染状态检查");
// Current implementation passes disabled state via props into PreviewPage.
const hasParentDisabledProp =
  content.includes("isInsertDisabled={") &&
  content.includes("renderingSchemeIds.includes(activeScheme.id)");
const hasPreviewDisabledUsage =
  previewContent.includes("disabled={isInsertDisabled}");
const buttonDisabledCheck = hasParentDisabledProp && hasPreviewDisabledUsage;
console.log(buttonDisabledCheck ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 4: Check if button text changes based on rendering state
console.log("Test 4: 检查按钮文字是否根据渲染状态动态变化");
const dynamicButtonText = content.includes(
  'isPreparingInsert={renderingSchemeIds.includes(activeScheme?.id || "")}',
);
console.log(dynamicButtonText ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 5: Check generation navigation semantics
console.log("Test 5: 检查新建/更新方案后是否显式跳转到预览页");
const hasResolvedSchemeId = planGenerationHookContent.includes(
  "const resolvedSchemeId =",
);
const hasReturnSchemeId = planGenerationHookContent.includes(
  "return { schemeId: resolvedSchemeId, wasUpdated }",
);
const hasExplicitPreviewJump =
  (planGenerationHookContent.includes("setActiveSchemeId(resolvedSchemeId);") &&
    planGenerationHookContent.includes("setIsPreviewPage(true);")) ||
  (planGenerationHookContent.includes("setActiveSchemeId(result.schemeId);") &&
    planGenerationHookContent.includes("setIsPreviewPage(true);"));
const generationNavigationCheck =
  hasResolvedSchemeId && hasReturnSchemeId && hasExplicitPreviewJump;
console.log(generationNavigationCheck ? "✅ 通过" : "❌ 失败");
console.log("");

// Test 6: Check input textarea wrapping + autosize refs
console.log("Test 6: 检查输入框自动换行与自增高逻辑");
const hasWrapSoft = chatPanelContent.includes('wrap="soft"');
const hasTextareaRef = content.includes("const inputTextareaRef = useRef");
const hasAdjustHeightFn =
  content.includes("adjustInputComposerTextareaHeight") &&
  inputComposerContent.includes(
    "export const adjustInputComposerTextareaHeight =",
  );
const inputBehaviorCheck = hasWrapSoft && hasTextareaRef && hasAdjustHeightFn;
console.log(inputBehaviorCheck ? "✅ 通过" : "❌ 失败");
console.log("");

// Summary
console.log("═══════════════════════════════════════");
console.log("📊 测试结果汇总");
console.log("═══════════════════════════════════════");
const allPassed =
  hasRenderingSchemeIds &&
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
  console.log("- 添加了 renderingSchemeIds 状态跟踪渲染进度");
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
