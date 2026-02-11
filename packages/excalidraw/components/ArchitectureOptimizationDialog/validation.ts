import type { GenerationSnapshot } from "./planGenerationContext";

const CATEGORY_SET = new Set(["性能", "安全", "成本", "扩展性", "可靠性"]);

export const parseSummaryLines = (summary: string): string[] =>
  summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["));

export const validateGenerationResult = (input: {
  summary: string;
  mermaid: string;
  snapshot?: GenerationSnapshot;
}): { ok: true } | { ok: false; reason: string } => {
  const { summary, mermaid, snapshot } = input;

  if (!mermaid.trim()) {
    return { ok: false, reason: "AI 未返回 Mermaid 架构图代码。" };
  }

  if (!/(^|\n)\s*(graph|flowchart)\s+(TD|LR|TB|RL|BT)\b/i.test(mermaid)) {
    return { ok: false, reason: "Mermaid 代码格式无效，请重试。" };
  }

  const summaryLines = parseSummaryLines(summary);
  if (summaryLines.length === 0) {
    return { ok: false, reason: "AI 未返回变更总结条目。" };
  }

  for (const line of summaryLines) {
    const categoryMatch = line.match(/^- \[([^\]]+)\]/);
    if (!categoryMatch || !CATEGORY_SET.has(categoryMatch[1])) {
      return { ok: false, reason: "变更总结中存在非法分类。" };
    }
  }

  if (snapshot && snapshot.selectedItems.length > 0) {
    if (summaryLines.length !== snapshot.selectedItems.length) {
      return {
        ok: false,
        reason: `变更总结条数(${summaryLines.length})与已选建议条数(${snapshot.selectedItems.length})不一致。`,
      };
    }
  }

  return { ok: true };
};
