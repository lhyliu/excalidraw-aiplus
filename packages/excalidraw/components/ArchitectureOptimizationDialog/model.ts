export type SuggestionCategory =
  | "performance"
  | "security"
  | "cost"
  | "scalability"
  | "reliability";

export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  content: string;
}

export interface PoolSuggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  content: string;
  fullContent: string;
  selected: boolean;
  archived?: boolean;
  note?: string;
}

export interface SuggestionCombination {
  id: string;
  name: string;
  suggestionIds: string[];
  createdAt: number;
}

export interface Scheme {
  id: string;
  version: number;
  summary: string;
  mermaid: string;
  shortSummary: string;
  title?: string;
  sourceCombinationId?: string | null;
  sourceSuggestionIds?: string[];
  sourceSuggestionSnapshot?: Array<{
    id: string;
    category: SuggestionCategory;
    title: string;
    content: string;
    fullContent: string;
    note?: string;
  }>;
}

export type ArchitectureStyle = "standard" | "minimal" | "detailed";

export interface PersistedAssistantState {
  suggestionPool: PoolSuggestion[];
  suggestionCombinations?: SuggestionCombination[];
  activeCombinationId?: string | null;
  architectureStyle: ArchitectureStyle;
  skipUpdateConfirm?: boolean;
  suggestionSearchKeyword?: string;
  showArchivedSuggestions?: boolean;
  draftInput?: string;
  activeSchemeId?: string | null;
  isPreviewPage?: boolean;
  isCompareMode?: boolean;
}

export const PRESET_QUESTIONS = [
  "请识别当前架构的三个最高优先级风险并给出改造建议。",
  "请给出提升可扩展性与可靠性的最小改造清单。",
  "请按性能、成本、安全三个维度给出优化建议。",
];

export const categoryLabels: Record<SuggestionCategory, string> = {
  performance: "性能",
  security: "安全",
  cost: "成本",
  scalability: "扩展性",
  reliability: "可靠性",
};

export const styleLabels: Record<ArchitectureStyle, string> = {
  standard: "标准模式",
  minimal: "极简模式",
  detailed: "详细模式",
};

export const parseSuggestions = (summary: string): Suggestion[] => {
  const suggestions: Suggestion[] = [];
  const lines = summary.split("\n").filter((line) => line.trim());

  const categoryKeywords: Record<SuggestionCategory, string[]> = {
    performance: ["性能", "速度", "延迟", "吞吐", "缓存", "优化", "响应"],
    security: ["安全", "认证", "授权", "加密", "防护", "审计", "风险"],
    cost: ["成本", "费用", "资源", "预算", "节省", "开销"],
    scalability: ["扩展", "伸缩", "负载", "分布式", "集群", "水平", "弹性"],
    reliability: ["可靠", "稳定", "容错", "备份", "恢复", "冗余", "高可用"],
  };

  let currentSuggestion = "";

  for (const line of lines) {
    const isListItem =
      /^[-*•\d.]\s/.test(line.trim()) || /^[（(]\d+[）)]/.test(line.trim());

    if (isListItem || line.includes("建议") || line.includes("优化")) {
      if (currentSuggestion) {
        let category: SuggestionCategory = "performance";
        const suggestionText = currentSuggestion;
        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some((kw) => suggestionText.includes(kw))) {
            category = cat as SuggestionCategory;
            break;
          }
        }
        suggestions.push({
          id: `suggestion-${suggestions.length}`,
          category,
          content: currentSuggestion.trim(),
        });
      }
      currentSuggestion = line.replace(/^[-*•\d.（(\d+）)]\s*/, "").trim();
    } else if (currentSuggestion) {
      currentSuggestion += ` ${line.trim()}`;
    }
  }

  if (currentSuggestion) {
    let category: SuggestionCategory = "performance";
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => currentSuggestion.includes(kw))) {
        category = cat as SuggestionCategory;
        break;
      }
    }
    suggestions.push({
      id: `suggestion-${suggestions.length}`,
      category,
      content: currentSuggestion.trim(),
    });
  }

  return suggestions.slice(0, 5);
};

export const extractTitle = (content: string): string => {
  const patterns = [
    /引入\s*([^\s,，。]+)/,
    /增加\s*([^\s,，。]+)/,
    /使用\s*([^\s,，。]+)/,
    /添加\s*([^\s,，。]+)/,
    /部署\s*([^\s,，。]+)/,
    /采用\s*([^\s,，。]+)/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return content.slice(0, 18) + (content.length > 18 ? "..." : "");
};

export const compactSuggestionContent = (content: string): string => {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 180)}...`;
};

export const normalizeSuggestionContent = (content: string): string =>
  content.replace(/\s+/g, " ").trim();
