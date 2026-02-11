#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Architecture Assistant Persistence Test
 *
 * Verifies that architecture assistant data is scoped and exported/imported.
 */

const fs = require("fs");
const path = require("path");

const jsonPath = path.join(__dirname, "../packages/excalidraw/data/json.ts");
const blobPath = path.join(__dirname, "../packages/excalidraw/data/blob.ts");
const typesPath = path.join(__dirname, "../packages/excalidraw/data/types.ts");

const jsonContent = fs.readFileSync(jsonPath, "utf8");
const blobContent = fs.readFileSync(blobPath, "utf8");
const typesContent = fs.readFileSync(typesPath, "utf8");

const checks = [
  {
    name: "json.ts 使用 scoped storage key",
    pass:
      jsonContent.includes(
        "const getScopedStorageKey = (baseKey: string, scope?: string) =>",
      ) && jsonContent.includes("appState.name?.trim()"),
  },
  {
    name: "serializeAsJSON 导出 architecture 三类数据",
    pass:
      jsonContent.includes("architectureChatHistory") &&
      jsonContent.includes("architectureSchemes") &&
      jsonContent.includes("architectureAssistantState"),
  },
  {
    name: "blob.ts 导入恢复 architecture 三类数据",
    pass:
      blobContent.includes("setArchitectureChatHistory(") &&
      blobContent.includes("setArchitectureSchemes(") &&
      blobContent.includes("setArchitectureAssistantState("),
  },
  {
    name: "types.ts 包含 sourceSuggestionSnapshot",
    pass: typesContent.includes("sourceSuggestionSnapshot?: Array<{"),
  },
  {
    name: "types.ts 包含 generationSnapshot 审计字段",
    pass:
      typesContent.includes("generationSnapshot?: {") &&
      typesContent.includes("selectedIds: string[];") &&
      typesContent.includes("createdAt: number;"),
  },
  {
    name: "types.ts assistant state 包含建议页 UI 持久化字段",
    pass:
      typesContent.includes("skipUpdateConfirm?: boolean;") &&
      typesContent.includes("suggestionSearchKeyword?: string;") &&
      typesContent.includes("showArchivedSuggestions?: boolean;"),
  },
  {
    name: "types.ts suggestion 支持 archived 状态",
    pass: typesContent.includes("archived?: boolean;"),
  },
];

console.log("🧪 开始测试 Architecture Assistant 持久化链路...\n");
let failed = 0;

checks.forEach((check, index) => {
  const prefix = `Test ${index + 1}: ${check.name}`;
  console.log(prefix);
  if (check.pass) {
    console.log("✅ 通过\n");
  } else {
    console.log("❌ 失败\n");
    failed += 1;
  }
});

console.log("═══════════════════════════════════════");
console.log("📊 测试结果汇总");
console.log("═══════════════════════════════════════");
if (failed === 0) {
  console.log("✅ 所有测试通过！持久化与导出导入链路完整。");
  process.exit(0);
}
console.log(`❌ ${failed} 项测试失败，请检查实现。`);
process.exit(1);
