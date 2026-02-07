import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useReducer,
} from "react";

import {
  FONT_FAMILY,
  getFontString,
  getLineHeight,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import {
  getCommonBounds,
  isNonDeletedElement,
  newTextElement,
  wrapText,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  ExcalidrawElement,
  StrokeStyle,
  Theme,
} from "@excalidraw/element/types";

import { useApp } from "../components/App";
import { useUIAppState } from "../context/ui-appState";
import { exportToSvg } from "../scene/export";

import {
  extractDiagramInfo,
  getArchitectureAnalysisPrompt,
  generateOptimizationPlan,
  isAIConfigured,
  runAIStream,
} from "../services/aiService";

import { convertMermaidToExcalidraw } from "./TTDDialog/common";

import { Dialog } from "./Dialog";
import { useAIStream } from "./hooks/useAIStream";
import { Switch } from "./Switch";

import {
  messagesReducer,
  type Message,
} from "./ArchitectureOptimizationDialog/messageState";
import "./ArchitectureOptimizationDialog.scss";
import "./ArchitectureOptimizationDialog.layout.scss";

import type { BinaryFiles } from "../types";
import type { MermaidToExcalidrawLibProps } from "./TTDDialog/types";

// Lucide-style icons as inline SVGs
const ImageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const ZoomInIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="11" x2="11" y1="8" y2="14" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </svg>
);

const MoveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="22" />
  </svg>
);

const MaximizeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const LightbulbIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const PanelRightOpenIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
    <path d="m10 15-3-3 3-3" />
  </svg>
);

const PanelRightCloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
    <path d="m8 9 3 3-3 3" />
  </svg>
);

const SparklesIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const SplitIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <line x1="12" x2="12" y1="3" y2="21" />
  </svg>
);

const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

interface ArchitectureOptimizationDialogProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
}

// Storage key for persisting chat history
const CHAT_STORAGE_KEY = "excalidraw_architecture_chat";
const SCHEMES_STORAGE_KEY = "excalidraw_architecture_schemes";
const ASSISTANT_STATE_STORAGE_KEY = "excalidraw_architecture_assistant_state";
const ARCHITECTURE_DIALOG_WIDTH = 1500;

const getScopedStorageKey = (baseKey: string, scope?: string) =>
  scope ? `${baseKey}::${scope}` : baseKey;

// Load chat history from localStorage
const loadChatHistory = (scope?: string): Message[] => {
  try {
    const saved =
      localStorage.getItem(getScopedStorageKey(CHAT_STORAGE_KEY, scope)) ||
      localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load chat history:", e);
  }
  return [];
};

// Save chat history to localStorage
const saveChatHistory = (messages: Message[], scope?: string): void => {
  try {
    // Only save non-generating messages without errors
    const messagesToSave = messages
      .filter((m) => !m.isGenerating && !m.error)
      .map(({ id, role, content }) => ({ id, role, content }));
    localStorage.setItem(
      getScopedStorageKey(CHAT_STORAGE_KEY, scope),
      JSON.stringify(messagesToSave),
    );
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
};

interface Scheme {
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

const loadSchemes = (scope?: string): Scheme[] => {
  try {
    const saved =
      localStorage.getItem(getScopedStorageKey(SCHEMES_STORAGE_KEY, scope)) ||
      localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as Scheme[];
    }
  } catch (e) {
    console.error("Failed to load schemes:", e);
  }
  return [];
};

const saveSchemes = (schemes: Scheme[], scope?: string): void => {
  try {
    localStorage.setItem(
      getScopedStorageKey(SCHEMES_STORAGE_KEY, scope),
      JSON.stringify(schemes),
    );
  } catch (e) {
    console.error("Failed to save schemes:", e);
  }
};

interface PersistedAssistantState {
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

const loadAssistantState = (scope?: string): PersistedAssistantState | null => {
  try {
    const saved =
      localStorage.getItem(
        getScopedStorageKey(ASSISTANT_STATE_STORAGE_KEY, scope),
      ) || localStorage.getItem(ASSISTANT_STATE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as PersistedAssistantState;
    }
  } catch (e) {
    console.error("Failed to load assistant state:", e);
  }
  return null;
};

const saveAssistantState = (
  state: PersistedAssistantState,
  scope?: string,
): void => {
  try {
    localStorage.setItem(
      getScopedStorageKey(ASSISTANT_STATE_STORAGE_KEY, scope),
      JSON.stringify(state),
    );
  } catch (e) {
    console.error("Failed to save assistant state:", e);
  }
};

// Suggestion card types
type SuggestionCategory =
  | "performance"
  | "security"
  | "cost"
  | "scalability"
  | "reliability";

interface Suggestion {
  id: string;
  category: SuggestionCategory;
  content: string;
}

// Helper to parse suggestions from summary text
const parseSuggestions = (summary: string): Suggestion[] => {
  const suggestions: Suggestion[] = [];
  const lines = summary.split("\n").filter((line) => line.trim());

  // Keywords mapping to categories
  const categoryKeywords: Record<SuggestionCategory, string[]> = {
    performance: ["性能", "速度", "延迟", "吞吐", "缓存", "优化", "响应"],
    security: ["安全", "认证", "授权", "加密", "防护", "审计", "风险"],
    cost: ["成本", "费用", "资源", "预算", "节省", "开销"],
    scalability: ["扩展", "伸缩", "负载", "分布式", "集群", "水平", "弹性"],
    reliability: ["可靠", "稳定", "容错", "备份", "恢复", "冗余", "高可用"],
  };

  let currentSuggestion = "";

  for (const line of lines) {
    // Check if line starts with a list marker
    const isListItem =
      /^[-*•\d.]\s/.test(line.trim()) || /^[（(]\d+[）)]/.test(line.trim());

    if (isListItem || line.includes("建议") || line.includes("优化")) {
      if (currentSuggestion) {
        // Determine category for current suggestion
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

  // Add last suggestion
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

  // Limit to 5 suggestions
  return suggestions.slice(0, 5);
};

// Category label mapping
const categoryLabels: Record<SuggestionCategory, string> = {
  performance: "性能",
  security: "安全",
  cost: "成本",
  scalability: "扩展性",
  reliability: "可靠性",
};

// Pool suggestion for staging area workflow
interface PoolSuggestion {
  id: string;
  category: SuggestionCategory;
  title: string; // Short title like "Redis 缓存"
  content: string; // Compact description
  fullContent: string; // Full description
  selected: boolean; // Whether added to staging
  archived?: boolean; // Whether archived from active pool
  note?: string; // User's custom note
}

interface SuggestionCombination {
  id: string;
  name: string;
  suggestionIds: string[];
  createdAt: number;
}

// Architecture generation styles
type ArchitectureStyle = "standard" | "minimal" | "detailed";

const styleLabels: Record<ArchitectureStyle, string> = {
  standard: "标准模式",
  minimal: "极简模式",
  detailed: "详细模式",
};

const PRESET_QUESTIONS = [
  "请识别当前架构的三个最高优先级风险并给出改造建议。",
  "请给出提升可扩展性与可靠性的最小改造清单。",
  "请按性能、成本、安全三个维度给出优化建议。",
];

// Extract short title from suggestion content
const extractTitle = (content: string): string => {
  // Common patterns: "引入 X", "增加 X", "使用 X", "添加 X"
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

  // Fallback: first 10 chars
  return content.slice(0, 18) + (content.length > 18 ? "..." : "");
};

const compactSuggestionContent = (content: string): string => {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 180)}...`;
};

const normalizeSuggestionContent = (content: string): string =>
  content.replace(/\s+/g, " ").trim();

export const ArchitectureOptimizationDialog: React.FC<
  ArchitectureOptimizationDialogProps
> = ({ elements, onClose, onOpenAISettings }) => {
  const app = useApp();
  const uiAppState = useUIAppState();
  const storageScope = (uiAppState.name || "default").trim();

  // Load persisted messages on init
  const [messages, dispatchMessages] = useReducer(
    messagesReducer,
    undefined,
    () => loadChatHistory(storageScope),
  );
  const [inputValue, setInputValue] = useState(
    () => loadAssistantState(storageScope)?.draftInput ?? "",
  );
  const [schemes, setSchemes] = useState<Scheme[]>(() =>
    loadSchemes(storageScope),
  );
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(() => {
    const savedAssistantState = loadAssistantState(storageScope);
    if (savedAssistantState?.activeSchemeId) {
      return savedAssistantState.activeSchemeId;
    }
    const savedSchemes = loadSchemes(storageScope);
    return savedSchemes.length > 0
      ? savedSchemes[savedSchemes.length - 1].id
      : null;
  });
  const [isCompareMode, setIsCompareMode] = useState(
    () => loadAssistantState(storageScope)?.isCompareMode ?? false,
  );
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [originalPreviewError, setOriginalPreviewError] =
    useState<Error | null>(null);
  const [renderingSchemes, setRenderingSchemes] = useState<Set<string>>(
    new Set(),
  );

  // 删除功能状态
  const [selectedSchemes, setSelectedSchemes] = useState<Set<string>>(
    new Set(),
  );
  const [deletedSchemesBuffer, setDeletedSchemesBuffer] = useState<{
    schemes: Scheme[];
    activeId: string | null;
    timeoutId: number;
  } | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Advanced workbench state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [highlightedSuggestionId, setHighlightedSuggestionId] = useState<
    string | null
  >(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanMode, setIsPanMode] = useState(false);

  // Semi-automatic workflow state
  const [suggestionPool, setSuggestionPool] = useState<PoolSuggestion[]>(
    () => loadAssistantState(storageScope)?.suggestionPool ?? [],
  );
  const [suggestionCombinations, setSuggestionCombinations] = useState<
    SuggestionCombination[]
  >(() => loadAssistantState(storageScope)?.suggestionCombinations ?? []);
  const [activeCombinationId, setActiveCombinationId] = useState<string | null>(
    () => loadAssistantState(storageScope)?.activeCombinationId ?? null,
  );
  const [architectureStyle, setArchitectureStyle] = useState<ArchitectureStyle>(
    () => loadAssistantState(storageScope)?.architectureStyle ?? "standard",
  );
  const [skipUpdateConfirm, setSkipUpdateConfirm] = useState(
    () => loadAssistantState(storageScope)?.skipUpdateConfirm ?? false,
  );
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(
    null,
  );
  const [suggestionSearchKeyword, setSuggestionSearchKeyword] = useState(
    () => loadAssistantState(storageScope)?.suggestionSearchKeyword ?? "",
  );
  const [showArchivedSuggestions, setShowArchivedSuggestions] = useState(
    () => loadAssistantState(storageScope)?.showArchivedSuggestions ?? false,
  );
  const [suggestionToast, setSuggestionToast] = useState<string | null>(null);
  const [expandedSuggestionIds, setExpandedSuggestionIds] = useState<
    Set<string>
  >(new Set());
  const [isPreviewPage, setIsPreviewPage] = useState(
    () => loadAssistantState(storageScope)?.isPreviewPage ?? false,
  );

  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
    useState<MermaidToExcalidrawLibProps>({
      loaded: false,
      api: import("@excalidraw/mermaid-to-excalidraw"),
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const originalPreviewCanvasRef = useRef<HTMLDivElement>(null);
  const previewRetryRef = useRef(0);
  const suggestionToastTimerRef = useRef<number | null>(null);
  const stagingAreaRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const schemeDataRefs = useRef<
    Record<
      string,
      React.MutableRefObject<{
        elements: readonly NonDeletedExcalidrawElement[];
        files: BinaryFiles | null;
      }>
    >
  >({});

  const { run: runStream, abort: abortStream, isStreaming } = useAIStream();

  const getSchemeDataRef = useCallback((schemeId: string) => {
    if (!schemeDataRefs.current[schemeId]) {
      schemeDataRefs.current[schemeId] = {
        current: { elements: [], files: null },
      };
    }
    return schemeDataRefs.current[schemeId];
  }, []);

  const fitPreviewToViewport = useCallback(
    (
      canvasRef: React.RefObject<HTMLDivElement | null>,
      schemeId?: string | null,
    ) => {
      const host = canvasRef.current;
      const container = host?.parentElement;
      if (!host || !container) {
        return;
      }

      let contentWidth = 0;
      let contentHeight = 0;

      if (schemeId) {
        const dataRef = getSchemeDataRef(schemeId);
        const sceneElements = dataRef.current.elements;
        if (sceneElements.length > 0) {
          const [minX, minY, maxX, maxY] = getCommonBounds(sceneElements);
          contentWidth = Math.max(1, maxX - minX);
          contentHeight = Math.max(1, maxY - minY);
        }
      }

      if (contentWidth <= 0 || contentHeight <= 0) {
        const renderedNode = host.querySelector("canvas, svg");
        if (!renderedNode) {
          setViewport({ x: 0, y: 0, zoom: 1 });
          return;
        }
        if (renderedNode instanceof HTMLCanvasElement) {
          const ratio = window.devicePixelRatio || 1;
          contentWidth = renderedNode.width / ratio;
          contentHeight = renderedNode.height / ratio;
        } else if (renderedNode instanceof SVGSVGElement) {
          const viewBox = renderedNode.viewBox?.baseVal;
          if (viewBox?.width && viewBox?.height) {
            contentWidth = viewBox.width;
            contentHeight = viewBox.height;
          } else {
            const box = renderedNode.getBoundingClientRect();
            contentWidth = box.width;
            contentHeight = box.height;
          }
        }
      }

      if (contentWidth <= 0 || contentHeight <= 0) {
        setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }

      const padding = 24;
      const availableWidth = Math.max(1, container.clientWidth - padding * 2);
      const availableHeight = Math.max(1, container.clientHeight - padding * 2);
      const zoom = Math.max(
        0.05,
        Math.min(
          1,
          availableWidth / contentWidth,
          availableHeight / contentHeight,
        ),
      );
      setViewport({ x: 0, y: 0, zoom });
    },
    [getSchemeDataRef],
  );

  const activeScheme =
    schemes.find((scheme) => scheme.id === activeSchemeId) ||
    schemes[schemes.length - 1] ||
    null;

  useEffect(() => {
    const fn = async () => {
      await mermaidToExcalidrawLib.api;
      setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
    };
    fn();
  }, [mermaidToExcalidrawLib.api]);

  useEffect(() => {
    if (schemes.length === 0) {
      setActiveSchemeId(null);
      return;
    }
    if (!activeSchemeId) {
      setActiveSchemeId(schemes[schemes.length - 1].id);
    }
  }, [schemes, activeSchemeId]);

  useEffect(() => {
    saveSchemes(schemes, storageScope);
  }, [schemes, storageScope]);

  useEffect(() => {
    saveAssistantState(
      {
        suggestionPool,
        suggestionCombinations,
        activeCombinationId,
        architectureStyle,
        skipUpdateConfirm,
        suggestionSearchKeyword,
        showArchivedSuggestions,
        draftInput: inputValue,
        activeSchemeId,
        isPreviewPage,
        isCompareMode,
      },
      storageScope,
    );
  }, [
    suggestionPool,
    suggestionCombinations,
    activeCombinationId,
    architectureStyle,
    skipUpdateConfirm,
    suggestionSearchKeyword,
    showArchivedSuggestions,
    inputValue,
    activeSchemeId,
    isPreviewPage,
    isCompareMode,
    storageScope,
  ]);

  // Render preview when result changes
  useEffect(() => {
    if (!isPreviewPage) {
      return;
    }

    const renderPreview = async (
      scheme: Scheme | null,
      canvasRef: React.RefObject<HTMLDivElement | null>,
      setError: (err: Error | null) => void,
      autoFit = false,
    ) => {
      if (
        !scheme?.mermaid ||
        !mermaidToExcalidrawLib.loaded ||
        !canvasRef.current
      ) {
        return;
      }

      const parent = canvasRef.current.parentElement;
      if (!parent || parent.offsetWidth === 0 || parent.offsetHeight === 0) {
        if (previewRetryRef.current < 5) {
          previewRetryRef.current += 1;
          requestAnimationFrame(() =>
            renderPreview(scheme, canvasRef, setError),
          );
        } else {
          setError(new Error("Preview container has no size"));
        }
        return;
      }

      const dataRef = getSchemeDataRef(scheme.id);

      // Mark scheme as rendering
      setRenderingSchemes((prev) => new Set(prev).add(scheme.id));

      try {
        await convertMermaidToExcalidraw({
          canvasRef,
          mermaidToExcalidrawLib,
          mermaidDefinition: scheme.mermaid,
          setError: (err) => {
            setError(err);
            if (err) {
              console.error("Mermaid preview error", err);
            }
          },
          data: dataRef,
          theme: uiAppState.theme as Theme,
        });
        if (autoFit) {
          requestAnimationFrame(() =>
            fitPreviewToViewport(canvasRef, scheme.id),
          );
        }
      } finally {
        // Mark scheme as finished rendering
        setRenderingSchemes((prev) => {
          const next = new Set(prev);
          next.delete(scheme.id);
          return next;
        });
      }
    };

    previewRetryRef.current = 0;
    setPreviewError(null);
    renderPreview(activeScheme, previewCanvasRef, setPreviewError, true);
  }, [
    activeScheme,
    fitPreviewToViewport,
    getSchemeDataRef,
    isPreviewPage,
    mermaidToExcalidrawLib,
    mermaidToExcalidrawLib.loaded,
    uiAppState.theme,
  ]);

  useEffect(() => {
    if (!isPreviewPage || !activeScheme) {
      return;
    }
    fitPreviewToViewport(previewCanvasRef, activeScheme.id);
  }, [activeScheme, fitPreviewToViewport, isCompareMode, isPreviewPage]);

  useEffect(() => {
    if (!isPreviewPage || !activeScheme) {
      return;
    }

    const host = previewCanvasRef.current;
    const container = host?.parentElement;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      // Auto-fit on container resize (windowed mode / compare toggle / layout changes).
      fitPreviewToViewport(previewCanvasRef, activeScheme.id);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeScheme, fitPreviewToViewport, isPreviewPage]);

  useEffect(() => {
    if (!isPreviewPage || !isCompareMode) {
      return;
    }

    const container = originalPreviewCanvasRef.current;
    if (!container) {
      return;
    }

    let isCancelled = false;
    const renderOriginalPreview = async () => {
      setOriginalPreviewError(null);

      const nonDeletedElements = elements.filter(isNonDeletedElement);
      if (nonDeletedElements.length === 0) {
        container.replaceChildren();
        return;
      }

      try {
        const svg = await exportToSvg(
          nonDeletedElements,
          {
            exportBackground: true,
            exportPadding: 16,
            viewBackgroundColor: uiAppState.viewBackgroundColor,
            exportWithDarkMode: uiAppState.theme === "dark",
            frameRendering: uiAppState.frameRendering,
          },
          null,
        );

        if (isCancelled) {
          return;
        }

        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        container.replaceChildren(svg);
      } catch (error) {
        if (!isCancelled) {
          setOriginalPreviewError(
            error instanceof Error ? error : new Error("原架构图渲染失败"),
          );
        }
      }
    };

    void renderOriginalPreview();

    return () => {
      isCancelled = true;
    };
  }, [
    elements,
    isCompareMode,
    isPreviewPage,
    uiAppState.frameRendering,
    uiAppState.theme,
    uiAppState.viewBackgroundColor,
  ]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages to localStorage when they change (debounced)
  useEffect(() => {
    if (!isStreaming) {
      saveChatHistory(messages, storageScope);
    }
  }, [messages, isStreaming, storageScope]);

  // 清理撤销缓冲区
  useEffect(() => {
    return () => {
      if (deletedSchemesBuffer?.timeoutId) {
        clearTimeout(deletedSchemesBuffer.timeoutId);
      }
      if (suggestionToastTimerRef.current) {
        clearTimeout(suggestionToastTimerRef.current);
      }
    };
  }, [deletedSchemesBuffer]);

  const handleStartAnalysis = useCallback(async () => {
    if (isStreaming) {
      return;
    }

    const diagramInfo = extractDiagramInfo(elements);
    const selectedContext = suggestionPool
      .filter((s) => s.selected)
      .map(
        (s) =>
          `- [${categoryLabels[s.category]}] ${s.fullContent}${
            s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");
    const systemPrompt = `${getArchitectureAnalysisPrompt(diagramInfo)}${
      selectedContext
        ? `\n\n【已选建议工作集（请作为本轮上下文参考，不要忽略）】\n${selectedContext}`
        : ""
    }`;

    const userMsgId = `msg-${Date.now()}`;
    const assistantMsgId = `msg-${Date.now() + 1}`;

    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: "请分析当前架构图并提供优化建议。",
    };

    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isGenerating: true,
    };

    dispatchMessages({
      type: "add",
      messages: [userMessage, assistantMessage],
    });

    let reasoningBuffer = "";
    let contentBuffer = "";
    const result = await runStream((signal) =>
      runAIStream(
        [
          { role: "system", content: systemPrompt },
          ...messages
            .filter((m) => !m.error)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          { role: "user", content: userMessage.content },
        ],
        {
          onChunk: (chunk) => {
            contentBuffer += chunk;
            const display = `${
              reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""
            }${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onReasoning: (chunk) => {
            reasoningBuffer += chunk;
            const display = `${
              reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""
            }${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onComplete: () => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false },
            });
            if (contentBuffer) {
              const parsed = parseSuggestions(contentBuffer);
              setSuggestionPool((prev) => {
                const existing = new Set(
                  prev.map((p) => p.content.slice(0, 50)),
                );
                const unique = parsed
                  .filter(
                    (s) =>
                      !existing.has(
                        compactSuggestionContent(s.content).slice(0, 50),
                      ),
                  )
                  .map((s, idx) => ({
                    id: `pool-${Date.now()}-${idx}`,
                    category: s.category,
                    title: extractTitle(compactSuggestionContent(s.content)),
                    content: compactSuggestionContent(s.content),
                    fullContent: normalizeSuggestionContent(s.content),
                    selected: false,
                    archived: false,
                  }));
                return [...prev, ...unique];
              });
            }
          },
          onError: (error) => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false, error: error.message },
            });
          },
          includeReasoning: true,
        },
        signal,
      ),
    );

    if (!result.success) {
      dispatchMessages({
        type: "update",
        id: assistantMsgId,
        patch: { isGenerating: false, error: result.error || "Unknown error" },
      });
    }
  }, [elements, messages, runStream, isStreaming, suggestionPool]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) {
      return;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
    };

    const assistantMsgId = `msg-${Date.now() + 1}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isGenerating: true,
    };

    dispatchMessages({
      type: "add",
      messages: [userMessage, assistantMessage],
    });
    setInputValue("");

    // Build message history for API
    const diagramInfo = extractDiagramInfo(elements);
    const selectedContext = suggestionPool
      .filter((s) => s.selected)
      .map(
        (s) =>
          `- [${categoryLabels[s.category]}] ${s.fullContent}${
            s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");
    const systemPrompt = `${getArchitectureAnalysisPrompt(diagramInfo)}${
      selectedContext
        ? `\n\n【已选建议工作集（请作为本轮上下文参考，不要忽略）】\n${selectedContext}`
        : ""
    }`;
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => !m.error)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user" as const, content: userMessage.content },
    ];

    let reasoningBuffer = "";
    let contentBuffer = "";
    const result = await runStream((signal) =>
      runAIStream(
        apiMessages,
        {
          onChunk: (chunk) => {
            contentBuffer += chunk;
            const display = `${
              reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""
            }${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onReasoning: (chunk) => {
            reasoningBuffer += chunk;
            const display = `${
              reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""
            }${contentBuffer}`;
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { content: display },
            });
          },
          onComplete: () => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false },
            });
            // Auto-extract suggestions to pool
            if (contentBuffer) {
              extractSuggestionsToPool(contentBuffer);
            }
          },
          onError: (error) => {
            dispatchMessages({
              type: "update",
              id: assistantMsgId,
              patch: { isGenerating: false, error: error.message },
            });
          },
          includeReasoning: true,
        },
        signal,
      ),
    );
    if (!result.success) {
      dispatchMessages({
        type: "update",
        id: assistantMsgId,
        patch: { isGenerating: false, error: result.error || "Unknown error" },
      });
    }
  }, [inputValue, messages, elements, runStream, isStreaming, suggestionPool]);

  const handleSendPresetQuestion = useCallback((question: string) => {
    setInputValue(question);
  }, []);

  const handleAbort = useCallback(() => {
    abortStream();
    dispatchMessages({
      type: "updateLast",
      predicate: (m) => m.role === "assistant" && Boolean(m.isGenerating),
      patch: { isGenerating: false, error: "Request aborted" },
    });
  }, [abortStream]);

  const handleClearHistory = useCallback(() => {
    dispatchMessages({ type: "replace", messages: [] });
    localStorage.removeItem(
      getScopedStorageKey(CHAT_STORAGE_KEY, storageScope),
    );
  }, [storageScope]);

  const handleUploadImage = useCallback(() => {
    if (isStreaming) {
      return;
    }
    dispatchMessages({
      type: "add",
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content:
            "图片上传功能正在开发中，当前请直接在画布中绘制架构，或在输入框用文字描述。",
        },
      ],
    });
  }, [isStreaming]);

  // === Semi-automatic workflow handlers ===

  // Extract suggestions from AI response and add to pool
  function extractSuggestionsToPool(content: string) {
    const parsed = parseSuggestions(content);
    const newSuggestions: PoolSuggestion[] = parsed.map((s, idx) => ({
      id: `pool-${Date.now()}-${idx}`,
      category: s.category,
      title: extractTitle(compactSuggestionContent(s.content)),
      content: compactSuggestionContent(s.content),
      fullContent: normalizeSuggestionContent(s.content),
      selected: false,
      archived: false,
    }));

    setSuggestionPool((prev) => {
      // Avoid duplicates by checking content similarity
      const existing = new Set(prev.map((p) => p.content.slice(0, 50)));
      const unique = newSuggestions.filter(
        (s) =>
          !existing.has(compactSuggestionContent(s.fullContent).slice(0, 50)),
      );
      return [...prev, ...unique];
    });
  }

  // Toggle suggestion selection
  const toggleSuggestionSelection = useCallback((id: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    );
  }, []);

  // Update suggestion note
  const updateSuggestionNote = useCallback((id: string, note: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) => (s.id === id ? { ...s, note } : s)),
    );
  }, []);

  const applySuggestionToPool = useCallback((suggestion: Suggestion) => {
    let isExisting = false;
    const compactSuggestion = compactSuggestionContent(suggestion.content);
    setSuggestionPool((prev) => {
      const existing = prev.find(
        (item) => item.content.slice(0, 50) === compactSuggestion.slice(0, 50),
      );
      if (existing) {
        isExisting = true;
        return prev.map((item) =>
          item.id === existing.id ? { ...item, selected: true } : item,
        );
      }
      return [
        ...prev,
        {
          id: `pool-${Date.now()}`,
          category: suggestion.category,
          title: extractTitle(compactSuggestion),
          content: compactSuggestion,
          fullContent: normalizeSuggestionContent(suggestion.content),
          selected: true,
          archived: false,
        },
      ];
    });
    stagingAreaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setSuggestionToast(isExisting ? "建议已加入已选区域" : "建议已添加并选中");
    if (suggestionToastTimerRef.current) {
      clearTimeout(suggestionToastTimerRef.current);
    }
    suggestionToastTimerRef.current = window.setTimeout(() => {
      setSuggestionToast(null);
      suggestionToastTimerRef.current = null;
    }, 1600);
  }, []);

  // Get selected suggestions
  const selectedSuggestions = suggestionPool.filter((s) => s.selected);
  const selectedSuggestionIds = selectedSuggestions.map((s) => s.id);
  const visibleSuggestions = suggestionPool.filter((s) => {
    if (!showArchivedSuggestions && s.archived) {
      return false;
    }
    if (!suggestionSearchKeyword.trim()) {
      return true;
    }
    const keyword = suggestionSearchKeyword.trim().toLowerCase();
    return (
      s.title.toLowerCase().includes(keyword) ||
      s.content.toLowerCase().includes(keyword) ||
      s.fullContent.toLowerCase().includes(keyword)
    );
  });

  const selectedSuggestionSnapshot = selectedSuggestions.map((s) => ({
    id: s.id,
    category: s.category,
    title: s.title,
    content: s.content,
    fullContent: s.fullContent,
    note: s.note,
  }));

  const handleSaveCombination = useCallback(() => {
    if (selectedSuggestionIds.length === 0) {
      setSuggestionToast("请先勾选建议再保存组合");
      return;
    }
    const name = window
      .prompt("请输入组合名称", `组合 ${suggestionCombinations.length + 1}`)
      ?.trim();
    if (!name) {
      return;
    }

    const combination: SuggestionCombination = {
      id: `comb-${Date.now()}`,
      name,
      suggestionIds: selectedSuggestionIds,
      createdAt: Date.now(),
    };
    setSuggestionCombinations((prev) => [...prev, combination]);
    setActiveCombinationId(combination.id);
    setSuggestionToast(`已保存组合：${name}`);
  }, [selectedSuggestionIds, suggestionCombinations.length]);

  const applyCombination = useCallback(
    (combinationId: string) => {
      const combination = suggestionCombinations.find(
        (c) => c.id === combinationId,
      );
      if (!combination) {
        return;
      }
      const idSet = new Set(combination.suggestionIds);
      setSuggestionPool((prev) =>
        prev.map((s) => ({ ...s, selected: idSet.has(s.id) })),
      );
      setActiveCombinationId(combination.id);
    },
    [suggestionCombinations],
  );

  const removeCombination = useCallback((combinationId: string) => {
    setSuggestionCombinations((prev) =>
      prev.filter((combination) => combination.id !== combinationId),
    );
    setActiveCombinationId((prev) => (prev === combinationId ? null : prev));
  }, []);

  const archiveSuggestion = useCallback((id: string) => {
    setSuggestionPool((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, archived: true, selected: false } : s,
      ),
    );
    setSuggestionToast("建议已归档");
  }, []);

  const clearSuggestionPool = useCallback(() => {
    if (suggestionPool.length === 0 && suggestionCombinations.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      "将清空建议列表及所有组合，该操作不可恢复。是否继续？",
    );
    if (!confirmed) {
      return;
    }
    setSuggestionPool([]);
    setSuggestionCombinations([]);
    setActiveCombinationId(null);
    setExpandedSuggestionIds(new Set());
    setEditingSuggestionId(null);
    setSuggestionToast("建议列表已清空");
  }, [suggestionPool.length, suggestionCombinations.length]);

  useEffect(() => {
    if (!activeCombinationId) {
      return;
    }
    setSuggestionCombinations((prev) =>
      prev.map((combination) => {
        if (combination.id !== activeCombinationId) {
          return combination;
        }
        const unchanged =
          combination.suggestionIds.length === selectedSuggestionIds.length &&
          combination.suggestionIds.every(
            (id, index) => id === selectedSuggestionIds[index],
          );
        return unchanged
          ? combination
          : { ...combination, suggestionIds: selectedSuggestionIds };
      }),
    );
  }, [activeCombinationId, selectedSuggestionIds]);

  const runPlanGeneration = useCallback(
    async (
      extraContext?: string,
      options?: {
        targetSchemeId?: string | null;
        forceCreate?: boolean;
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
      },
    ): Promise<{ schemeId: string; wasUpdated: boolean } | null> => {
      if (isStreaming || (messages.length === 0 && !extraContext?.trim())) {
        return null;
      }
      const diagramInfo = extractDiagramInfo(elements);

      // Add a temporary system message to show what's happening
      const assistantMsgId = `msg-${Date.now()}`;
      dispatchMessages({
        type: "add",
        messages: [
          {
            id: assistantMsgId,
            role: "assistant",
            content: "正在生成优化方案和新架构图...",
            isGenerating: true,
          },
        ],
      });

      try {
        // Messages history
        const historyMessages = messages
          .filter((m) => !m.error && !m.isGenerating)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        if (extraContext?.trim()) {
          historyMessages.push({
            role: "user",
            content: extraContext.trim(),
          });
        }

        let reasoningBuffer = "";
        let summaryBuffer = "";
        const streamResult = await runStream((signal) =>
          generateOptimizationPlan(
            historyMessages,
            diagramInfo,
            (chunk) => {
              if (chunk.reasoning) {
                reasoningBuffer += chunk.reasoning;
              }
              if (chunk.summary) {
                summaryBuffer = chunk.summary;
              }
              const display = `${
                reasoningBuffer ? `思考中：\n${reasoningBuffer}\n\n` : ""
              }${summaryBuffer || "正在生成..."}`;
              dispatchMessages({
                type: "update",
                id: assistantMsgId,
                patch: { content: display },
              });
            },
            signal,
          ),
        );

        if (!streamResult.success) {
          throw new Error(streamResult.error || "Unknown error");
        }
        const result = streamResult.data;

        // Validate result
        if (!result.mermaid || result.mermaid.trim() === "") {
          // No Mermaid code found - show error
          dispatchMessages({
            type: "update",
            id: assistantMsgId,
            patch: {
              content: `AI未能生成有效的Mermaid图表代码。请尝试更具体地描述您需要的架构优化。\n\n以下是AI的回复：\n${result.summary}`,
              isGenerating: false,
              error: "未找到Mermaid代码块",
            },
          });
          return null;
        }

        const shortSummary =
          result.summary.trim().split("\n").find(Boolean)?.trim() || "优化方案";
        let generatedVersion = 1;
        let wasUpdated = false;
        const targetSchemeId = options?.targetSchemeId ?? activeSchemeId;
        const shouldForceCreate = options?.forceCreate === true;
        const canUpdateExistingBySnapshot =
          !shouldForceCreate &&
          !!targetSchemeId &&
          schemes.some((s) => s.id === targetSchemeId);
        const createdSchemeId = `scheme-${Date.now()}`;
        const resolvedSchemeId =
          canUpdateExistingBySnapshot && targetSchemeId
            ? targetSchemeId
            : createdSchemeId;

        setSchemes((prev) => {
          const canUpdateExisting =
            !shouldForceCreate &&
            !!targetSchemeId &&
            prev.some((s) => s.id === targetSchemeId);

          if (canUpdateExisting && targetSchemeId) {
            const updated = prev.map((scheme) =>
              scheme.id === targetSchemeId
                ? {
                    ...scheme,
                    summary: result.summary,
                    mermaid: result.mermaid,
                    shortSummary,
                    sourceCombinationId: options?.sourceCombinationId ?? null,
                    sourceSuggestionIds: options?.sourceSuggestionIds ?? [],
                    sourceSuggestionSnapshot:
                      options?.sourceSuggestionSnapshot ?? [],
                  }
                : scheme,
            );
            const updatedScheme = updated.find((s) => s.id === targetSchemeId);
            generatedVersion = updatedScheme?.version ?? 1;
            wasUpdated = true;
            return updated;
          }

          const nextVersion =
            prev.length > 0 ? prev[prev.length - 1].version + 1 : 1;
          generatedVersion = nextVersion;
          const scheme: Scheme = {
            id: createdSchemeId,
            version: nextVersion,
            summary: result.summary,
            mermaid: result.mermaid,
            shortSummary,
            title: "",
            sourceCombinationId: options?.sourceCombinationId ?? null,
            sourceSuggestionIds: options?.sourceSuggestionIds ?? [],
            sourceSuggestionSnapshot: options?.sourceSuggestionSnapshot ?? [],
          };
          return [...prev, scheme];
        });
        setActiveSchemeId(resolvedSchemeId);
        setIsPreviewPage(true);
        setSuggestionToast(
          wasUpdated
            ? `已更新方案 ${generatedVersion}，可插入到主图旁`
            : `已生成方案 ${generatedVersion}，可插入到主图旁`,
        );
        if (suggestionToastTimerRef.current) {
          clearTimeout(suggestionToastTimerRef.current);
        }
        suggestionToastTimerRef.current = window.setTimeout(() => {
          setSuggestionToast(null);
          suggestionToastTimerRef.current = null;
        }, 2200);

        // Remove the temporary generating message
        dispatchMessages({ type: "remove", id: assistantMsgId });
        return { schemeId: resolvedSchemeId, wasUpdated };
      } catch (error) {
        console.error("Optimization failed", error);
        dispatchMessages({
          type: "update",
          id: assistantMsgId,
          patch: {
            content: String(error).includes("Request aborted")
              ? "已停止生成。"
              : "生成优化方案失败。",
            isGenerating: false,
            error: String(error),
          },
        });
        return null;
      }
    },
    [elements, messages, runStream, isStreaming, activeSchemeId, schemes],
  );

  // Generate architecture from selected suggestions
  const buildGenerationPrompt = useCallback(() => {
    if (selectedSuggestions.length === 0) {
      return;
    }

    const context = selectedSuggestions
      .map(
        (s) =>
          `- [${categoryLabels[s.category]}] ${s.content}${
            s.note ? ` (备注: ${s.note})` : ""
          }`,
      )
      .join("\n");

    const stylePrompt =
      architectureStyle === "minimal"
        ? "生成极简风格的架构图，只包含核心组件。"
        : architectureStyle === "detailed"
        ? "生成详细的架构图，包含所有子组件和连接。"
        : "生成标准风格的架构图。";

    return `基于以下已选优化建议，${stylePrompt}\n\n已选建议：\n${context}`;
  }, [selectedSuggestions, architectureStyle]);

  const generateNewFromSelected = useCallback(async () => {
    const prompt = buildGenerationPrompt();
    if (!prompt) {
      return;
    }

    const result = await runPlanGeneration(prompt, {
      targetSchemeId: activeSchemeId,
      forceCreate: true,
      sourceCombinationId: activeCombinationId,
      sourceSuggestionIds: selectedSuggestionIds,
      sourceSuggestionSnapshot: selectedSuggestionSnapshot,
    });
    if (result?.schemeId) {
      setActiveSchemeId(result.schemeId);
      setIsPreviewPage(true);
    }
  }, [
    buildGenerationPrompt,
    runPlanGeneration,
    activeSchemeId,
    activeCombinationId,
    selectedSuggestionIds,
    selectedSuggestionSnapshot,
  ]);

  const updateCurrentFromSelected = useCallback(async () => {
    const prompt = buildGenerationPrompt();
    if (!prompt || !activeSchemeId) {
      return;
    }

    if (!skipUpdateConfirm) {
      const confirmed = window.confirm(
        "将覆盖当前方案内容，历史内容不可自动恢复。是否继续？",
      );
      if (!confirmed) {
        return;
      }
      const dontAskAgain = window.confirm("后续更新当前方案时不再提示？");
      if (dontAskAgain) {
        setSkipUpdateConfirm(true);
      }
    }

    const result = await runPlanGeneration(prompt, {
      targetSchemeId: activeSchemeId,
      forceCreate: false,
      sourceCombinationId: activeCombinationId,
      sourceSuggestionIds: selectedSuggestionIds,
      sourceSuggestionSnapshot: selectedSuggestionSnapshot,
    });
    if (result?.schemeId) {
      setActiveSchemeId(result.schemeId);
      setIsPreviewPage(true);
    }
  }, [
    buildGenerationPrompt,
    activeSchemeId,
    skipUpdateConfirm,
    runPlanGeneration,
    activeCombinationId,
    selectedSuggestionIds,
    selectedSuggestionSnapshot,
  ]);

  const handleZoomIn = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.min(2.5, prev.zoom + 0.1) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom - 0.1) }));
  }, []);

  const handleTogglePanMode = useCallback(() => {
    setIsPanMode((prev) => !prev);
    panStartRef.current = null;
  }, []);

  const handleFitCanvas = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
    panStartRef.current = null;
  }, []);

  const handlePreviewPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode) {
        return;
      }
      e.preventDefault();
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isPanMode, viewport.x, viewport.y],
  );

  const handlePreviewPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode || !panStartRef.current) {
        return;
      }
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport((prev) => ({
        ...prev,
        x: panStartRef.current ? panStartRef.current.originX + dx : prev.x,
        y: panStartRef.current ? panStartRef.current.originY + dy : prev.y,
      }));
    },
    [isPanMode],
  );

  const handlePreviewPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode) {
        return;
      }
      panStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [isPanMode],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  const adjustInputTextareaHeight = useCallback(() => {
    const textarea = inputTextareaRef.current;
    if (!textarea) {
      return;
    }

    const chatPanelHeight = chatPanelRef.current?.clientHeight ?? 0;
    const maxHeight =
      chatPanelHeight > 0 ? Math.floor(chatPanelHeight * 0.5) : 320;
    const minHeight = 44;

    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, maxHeight),
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustInputTextareaHeight();
  }, [inputValue, adjustInputTextareaHeight]);

  useEffect(() => {
    const onResize = () => adjustInputTextareaHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [adjustInputTextareaHeight]);

  const handleRenameScheme = useCallback((schemeId: string, title: string) => {
    setSchemes((prev) =>
      prev.map((scheme) =>
        scheme.id === schemeId ? { ...scheme, title } : scheme,
      ),
    );
  }, []);

  // ========== 删除功能核心函数 ==========

  // 更新删除后的引用状态
  const updateSchemeRefsAfterDelete = useCallback(
    (newSchemes: Scheme[], deletedId: string) => {
      if (activeSchemeId === deletedId) {
        if (newSchemes.length > 0) {
          setActiveSchemeId(newSchemes[newSchemes.length - 1].id);
        } else {
          setActiveSchemeId(null);
        }
      }
    },
    [activeSchemeId],
  );

  // 单删（允许删完）
  const handleDeleteSingle = useCallback(
    (schemeId: string) => {
      if (!confirm("确定要删除此方案吗？")) {
        return;
      }

      const schemeToDelete = schemes.find((s) => s.id === schemeId);
      if (!schemeToDelete) {
        return;
      }

      const newSchemes = schemes.filter((s) => s.id !== schemeId);

      // 保存到撤销缓冲区
      setDeletedSchemesBuffer({
        schemes: [schemeToDelete],
        activeId: activeSchemeId,
        timeoutId: window.setTimeout(() => {
          setDeletedSchemesBuffer(null);
          setShowUndoToast(false);
        }, 5000),
      });

      // 执行删除
      setSchemes(newSchemes);
      updateSchemeRefsAfterDelete(newSchemes, schemeId);
      setShowUndoToast(true);
    },
    [schemes, activeSchemeId, updateSchemeRefsAfterDelete],
  );

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (selectedSchemes.size === 0) {
      return;
    }
    if (!confirm(`确定要删除选中的 ${selectedSchemes.size} 个方案吗？`)) {
      return;
    }

    const schemesToDelete = schemes.filter((s) => selectedSchemes.has(s.id));
    const newSchemes = schemes.filter((s) => !selectedSchemes.has(s.id));

    // 保存到撤销缓冲区
    setDeletedSchemesBuffer({
      schemes: schemesToDelete,
      activeId: activeSchemeId,
      timeoutId: window.setTimeout(() => {
        setDeletedSchemesBuffer(null);
        setShowUndoToast(false);
      }, 5000),
    });

    // 执行删除
    setSchemes(newSchemes);
    selectedSchemes.forEach((id) => {
      updateSchemeRefsAfterDelete(newSchemes, id);
    });
    setSelectedSchemes(new Set());
    setIsBatchMode(false);
    setShowUndoToast(true);
  }, [schemes, selectedSchemes, activeSchemeId, updateSchemeRefsAfterDelete]);

  // 撤销删除
  const handleUndoDelete = useCallback(() => {
    if (!deletedSchemesBuffer) {
      return;
    }

    // 清除超时
    clearTimeout(deletedSchemesBuffer.timeoutId);

    // 恢复方案
    setSchemes((prev) => {
      const restored = [...prev, ...deletedSchemesBuffer.schemes];
      // 保持原有顺序（按version排序）
      return restored.sort((a, b) => a.version - b.version);
    });

    // 恢复激活状态
    if (deletedSchemesBuffer.activeId) {
      setActiveSchemeId(deletedSchemesBuffer.activeId);
    }

    setDeletedSchemesBuffer(null);
    setShowUndoToast(false);
  }, [deletedSchemesBuffer]);

  const handleToggleCompare = useCallback((checked: boolean) => {
    setIsCompareMode(checked);
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    const result = await runPlanGeneration(undefined, {
      forceCreate: true,
      sourceCombinationId: activeCombinationId,
      sourceSuggestionIds: selectedSuggestionIds,
      sourceSuggestionSnapshot: selectedSuggestionSnapshot,
    });
    if (result?.schemeId) {
      setActiveSchemeId(result.schemeId);
      setIsPreviewPage(true);
    }
  }, [
    runPlanGeneration,
    activeCombinationId,
    selectedSuggestionIds,
    selectedSuggestionSnapshot,
  ]);

  const handleSelectScheme = useCallback(
    (schemeId: string) => {
      setActiveSchemeId(schemeId);
      const scheme = schemes.find((item) => item.id === schemeId);
      if (!scheme) {
        return;
      }

      if (scheme.sourceCombinationId) {
        const exists = suggestionCombinations.some(
          (combination) => combination.id === scheme.sourceCombinationId,
        );
        if (exists) {
          applyCombination(scheme.sourceCombinationId);
          return;
        }
      }

      if (scheme.sourceSuggestionIds && scheme.sourceSuggestionIds.length > 0) {
        const sourceIdSet = new Set(scheme.sourceSuggestionIds);
        setSuggestionPool((prev) => {
          const next = prev.map((s) => ({
            ...s,
            selected: sourceIdSet.has(s.id),
          }));
          if (!scheme.sourceSuggestionSnapshot?.length) {
            return next;
          }
          const existingIdSet = new Set(next.map((s) => s.id));
          const recovered = scheme.sourceSuggestionSnapshot
            .filter((item) => !existingIdSet.has(item.id))
            .map((item) => ({
              ...item,
              selected: true,
              archived: false,
            }));
          return [...next, ...recovered];
        });
        setActiveCombinationId(null);
      }
    },
    [schemes, suggestionCombinations, applyCombination],
  );

  const insertSchemeToCanvas = useCallback(
    (scheme: Scheme) => {
      const dataRef = getSchemeDataRef(scheme.id);
      if (!dataRef.current.elements || dataRef.current.elements.length === 0) {
        return;
      }

      const newElements = dataRef.current.elements;
      const files = dataRef.current.files;

      const referenceElements =
        app.scene.getNonDeletedElements().length > 0
          ? app.scene.getNonDeletedElements()
          : elements;

      const hasReference = referenceElements.length > 0;
      const [, refMinY, refMaxX] = hasReference
        ? getCommonBounds(referenceElements)
        : [0, 0, 0, 0];
      const [newMinX, , newMaxX, newMaxY] = getCommonBounds(newElements);
      const newWidth = newMaxX - newMinX;

      const title = scheme.title?.trim() || `方案 ${scheme.version}`;
      const summaryText = `${title}\n\n${scheme.summary.trim()}`;
      const fontFamily = FONT_FAMILY.Assistant;
      const fontSize = 16;
      const lineHeight = getLineHeight(fontFamily);
      const maxTextWidth = Math.max(260, Math.min(520, newWidth));
      const wrappedText = wrapText(
        summaryText,
        getFontString({ fontFamily, fontSize }),
        maxTextWidth,
      );
      const textElement = newTextElement({
        x: newMinX,
        y: newMaxY + 48,
        text: wrappedText,
        originalText: summaryText,
        fontSize,
        fontFamily,
        lineHeight,
        textAlign: "left",
        verticalAlign: "top",
        autoResize: false,
        strokeColor: "#1f2937",
        backgroundColor: "transparent",
      });

      const styledElements: NonDeletedExcalidrawElement[] =
        newElements.map<NonDeletedExcalidrawElement>((el) => {
          if (
            "strokeStyle" in el &&
            "strokeColor" in el &&
            "backgroundColor" in el
          ) {
            return {
              ...el,
              strokeStyle: "dashed" as StrokeStyle,
              strokeColor: "#6366f1",
              backgroundColor:
                el.backgroundColor === "transparent"
                  ? "transparent"
                  : "rgba(99, 102, 241, 0.08)",
            };
          }
          return el;
        });

      const combinedElements: readonly ExcalidrawElement[] = [
        ...styledElements,
        textElement,
      ];
      const [combinedMinX, combinedMinY, combinedMaxX, combinedMaxY] =
        getCommonBounds(combinedElements);
      const combinedWidth = combinedMaxX - combinedMinX;
      const combinedHeight = combinedMaxY - combinedMinY;

      const PADDING = 160;
      const targetLeft = hasReference ? refMaxX + PADDING : 0;
      const targetTop = hasReference ? refMinY : 0;
      const targetCenterX = targetLeft + combinedWidth / 2;
      const targetCenterY = targetTop + combinedHeight / 2;
      const { x: clientX, y: clientY } = sceneCoordsToViewportCoords(
        { sceneX: targetCenterX, sceneY: targetCenterY },
        app.state,
      );

      app.addElementsFromPasteOrLibrary({
        elements: combinedElements,
        files,
        position: { clientX, clientY },
        fitToContent: false,
      });

      onClose();
    },
    [app, elements, getSchemeDataRef, onClose],
  );

  // Show configuration prompt if AI is not configured
  if (!isAIConfigured()) {
    return (
      <Dialog
        className="architecture-optimization-dialog"
        onCloseRequest={onClose}
        title="AI架构助手"
        size={ARCHITECTURE_DIALOG_WIDTH}
      >
        <div className="architecture-optimization-dialog__not-configured">
          <p>请先配置AI API设置以使用AI架构助手功能。</p>
          <button
            className="architecture-optimization-dialog__config-button"
            onClick={onOpenAISettings}
          >
            打开AI设置
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      className="architecture-optimization-dialog"
      onCloseRequest={onClose}
      title="AI架构助手"
      size={ARCHITECTURE_DIALOG_WIDTH}
    >
      <div className="architecture-optimization-dialog__content">
        <div className="architecture-optimization-dialog__split">
          <div
            ref={chatPanelRef}
            className="architecture-optimization-dialog__panel architecture-optimization-dialog__panel--chat"
          >
            <div className="architecture-optimization-dialog__messages">
              {messages.length === 0 ? (
                <div className="architecture-optimization-dialog__welcome">
                  <h3>快速生成架构优化建议</h3>
                  <p>自动识别问题并生成可执行优化方案。</p>
                  <div className="architecture-optimization-dialog__welcome-actions">
                    <button
                      className="architecture-optimization-dialog__button architecture-optimization-dialog__button--primary architecture-optimization-dialog__button--hero"
                      onClick={handleStartAnalysis}
                      disabled={isStreaming}
                    >
                      开始分析画布
                    </button>
                    <p className="architecture-optimization-dialog__welcome-subhint">
                      预计 20-40 秒生成首批建议
                    </p>
                  </div>
                  <p className="architecture-optimization-dialog__welcome-hint">
                    或直接在下方输入您的问题
                  </p>
                  <div className="architecture-optimization-dialog__preset-list">
                    {PRESET_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        className="architecture-optimization-dialog__preset-chip"
                        onClick={() => handleSendPresetQuestion(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`architecture-optimization-dialog__message architecture-optimization-dialog__message--${message.role}`}
                  >
                    <div className="architecture-optimization-dialog__message-content">
                      {message.content}
                      {message.isGenerating && (
                        <span className="architecture-optimization-dialog__cursor">
                          ▌
                        </span>
                      )}
                    </div>
                    {message.error && (
                      <div className="architecture-optimization-dialog__message-error">
                        错误: {message.error}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="architecture-optimization-dialog__input-area">
              <div className="architecture-optimization-dialog__input-wrapper">
                <textarea
                  ref={inputTextareaRef}
                  className="architecture-optimization-dialog__input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    "描述优化目标\n例如：降低延迟、提升可用性、降低成本"
                  }
                  disabled={isStreaming}
                  rows={1}
                  wrap="soft"
                />
                <div className="architecture-optimization-dialog__input-side-actions">
                  <button
                    className="architecture-optimization-dialog__clear-button"
                    onClick={handleClearHistory}
                    disabled={isStreaming || messages.length === 0}
                    title="清除对话历史"
                    aria-label="清除对话历史"
                  >
                    <TrashIcon />
                  </button>
                  <button
                    className="architecture-optimization-dialog__input-icon-btn"
                    onClick={handleUploadImage}
                    title="上传图片（开发中）"
                    disabled={isStreaming}
                  >
                    <ImageIcon />
                  </button>
                  {isStreaming ? (
                    <button
                      className="architecture-optimization-dialog__button architecture-optimization-dialog__button--abort"
                      onClick={handleAbort}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      className="architecture-optimization-dialog__send-btn"
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim()}
                      title="发送"
                    >
                      <SendIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="architecture-optimization-dialog__panel architecture-optimization-dialog__panel--preview">
            {/* 批量操作工具栏 */}
            {schemes.length > 0 && (
              <div className="scheme-batch-toolbar">
                {!isBatchMode ? (
                  <button
                    className="scheme-batch-btn"
                    onClick={() => setIsBatchMode(true)}
                    title="进入批量模式"
                  >
                    ☑️ 批量操作
                  </button>
                ) : (
                  <>
                    <label className="scheme-select-all">
                      <input
                        type="checkbox"
                        checked={
                          selectedSchemes.size === schemes.length &&
                          schemes.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSchemes(
                              new Set(schemes.map((s) => s.id)),
                            );
                          } else {
                            setSelectedSchemes(new Set());
                          }
                        }}
                      />
                      全选 ({selectedSchemes.size}/{schemes.length})
                    </label>
                    <button
                      className="scheme-batch-delete-btn"
                      onClick={handleBatchDelete}
                      disabled={selectedSchemes.size === 0}
                    >
                      🗑️ 删除选中 ({selectedSchemes.size})
                    </button>
                    <button
                      className="scheme-batch-cancel-btn"
                      onClick={() => {
                        setIsBatchMode(false);
                        setSelectedSchemes(new Set());
                      }}
                    >
                      取消
                    </button>
                  </>
                )}
              </div>
            )}

            {/* 撤销Toast提示 */}
            {showUndoToast && deletedSchemesBuffer && (
              <div className="scheme-undo-toast">
                <span>已删除 {deletedSchemesBuffer.schemes.length} 个方案</span>
                <button onClick={handleUndoDelete}>撤销</button>
                <button onClick={() => setShowUndoToast(false)}>✕</button>
                <div className="scheme-undo-toast__progress" />
              </div>
            )}

            {/* IDE-style tabs */}
            <div className="ao-ide-tabs">
              <div className="ao-mode-switch">
                <button
                  className={
                    !isPreviewPage
                      ? "ao-mode-switch__btn ao-mode-switch__btn--active"
                      : "ao-mode-switch__btn"
                  }
                  onClick={() => setIsPreviewPage(false)}
                >
                  建议页
                </button>
                <button
                  className={
                    isPreviewPage
                      ? "ao-mode-switch__btn ao-mode-switch__btn--active"
                      : "ao-mode-switch__btn"
                  }
                  onClick={() => activeScheme && setIsPreviewPage(true)}
                  disabled={!activeScheme}
                >
                  预览页
                </button>
              </div>

              <button
                className="ao-ide-tab-add"
                onClick={handleGeneratePlan}
                title="生成新方案"
              >
                <PlusIcon />
              </button>

              {schemes.map((scheme) => {
                const isActive = scheme.id === activeScheme?.id;
                const tabTitle =
                  scheme.title?.trim() || `方案 ${scheme.version}`;
                const sourceCombinationName = scheme.sourceCombinationId
                  ? suggestionCombinations.find(
                      (combination) =>
                        combination.id === scheme.sourceCombinationId,
                    )?.name || "已删除组合"
                  : null;
                const tabSourceLabel = sourceCombinationName
                  ? ` · ${sourceCombinationName}`
                  : "";

                return (
                  <button
                    key={scheme.id}
                    className={`ao-ide-tab ${
                      isActive ? "ao-ide-tab--active" : ""
                    }`}
                    onClick={() => handleSelectScheme(scheme.id)}
                    title={
                      sourceCombinationName
                        ? `${tabTitle}（来源：${sourceCombinationName}）`
                        : tabTitle
                    }
                  >
                    <span className="ao-ide-tab__label">{`${tabTitle}${tabSourceLabel}`}</span>
                    <span
                      className="ao-ide-tab__close"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSingle(scheme.id);
                      }}
                    >
                      <XIcon />
                    </span>
                  </button>
                );
              })}
              {/* Compare mode toggle */}
              {isPreviewPage && (
                <div
                  className="architecture-optimization-dialog__compare-switch"
                  style={{ marginLeft: "auto" }}
                >
                  <SplitIcon />
                  <span style={{ fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                    对比
                  </span>
                  <Switch
                    name="compare-mode"
                    checked={isCompareMode}
                    onChange={handleToggleCompare}
                    disabled={elements.length === 0}
                  />
                </div>
              )}

              {/* Drawer toggle */}
              {isPreviewPage && (
                <button
                  className="ao-drawer-toggle"
                  style={{
                    position: "relative",
                    top: 0,
                    transform: "none",
                    marginLeft: "0.5rem",
                  }}
                  onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                  title={isDrawerOpen ? "关闭建议面板" : "打开建议面板"}
                >
                  {isDrawerOpen ? (
                    <PanelRightCloseIcon />
                  ) : (
                    <PanelRightOpenIcon />
                  )}
                </button>
              )}
            </div>

            {!isPreviewPage && (
              <>
                {/* Semi-Automatic Workflow Panel */}
                <div
                  className={`ao-workflow-panel ${
                    !isPreviewPage ? "ao-workflow-panel--expanded" : ""
                  }`}
                >
                  {suggestionToast && (
                    <div className="scheme-undo-toast">
                      <span>{suggestionToast}</span>
                      <button onClick={() => setSuggestionToast(null)}>
                        ✕
                      </button>
                    </div>
                  )}
                  {/* Staging Area - Top */}
                  <div className="ao-staging-area" ref={stagingAreaRef}>
                    <div className="ao-staging-area__header">
                      <h4>1. 选择建议</h4>
                      <div className="ao-staging-area__header-actions">
                        <button
                          className="ao-staging-area__clear-btn"
                          onClick={handleSaveCombination}
                        >
                          保存组合
                        </button>
                        {selectedSuggestions.length > 0 && (
                          <button
                            className="ao-staging-area__clear-btn"
                            onClick={() => {
                              setSuggestionPool((prev) =>
                                prev.map((s) => ({ ...s, selected: false })),
                              );
                              setActiveCombinationId(null);
                            }}
                          >
                            清空
                          </button>
                        )}
                      </div>
                    </div>
                    {suggestionCombinations.length > 0 && (
                      <div className="ao-staging-area__combinations">
                        {suggestionCombinations.map((combination) => (
                          <div
                            key={combination.id}
                            className={`ao-combination-chip ${
                              combination.id === activeCombinationId
                                ? "ao-combination-chip--active"
                                : ""
                            }`}
                          >
                            <button
                              onClick={() => applyCombination(combination.id)}
                            >
                              {combination.name}
                            </button>
                            <button
                              className="ao-combination-chip__remove"
                              onClick={() => removeCombination(combination.id)}
                              title="删除组合"
                            >
                              <XIcon />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="ao-staging-area__tags">
                      {selectedSuggestions.length > 0 ? (
                        selectedSuggestions.map((s) => (
                          <span
                            key={s.id}
                            className={`ao-staging-tag ao-staging-tag--${s.category}`}
                          >
                            {s.title}
                            <button
                              className="ao-staging-tag__remove"
                              onClick={() => toggleSuggestionSelection(s.id)}
                            >
                              <XIcon />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="ao-staging-area__empty">
                          从下方建议中勾选以添加
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Suggestion Pool - Middle */}
                  <div className="ao-suggestion-pool">
                    <div className="ao-suggestion-pool__header">
                      <h4>
                        <LightbulbIcon />
                        2. 从建议流中勾选
                      </h4>
                      <div className="ao-suggestion-pool__controls">
                        <button
                          className="ao-suggestion-pool__clear-all"
                          onClick={clearSuggestionPool}
                          disabled={
                            suggestionPool.length === 0 &&
                            suggestionCombinations.length === 0
                          }
                        >
                          清空列表
                        </button>
                        <input
                          className="ao-suggestion-pool__search"
                          placeholder="搜索建议..."
                          value={suggestionSearchKeyword}
                          onChange={(e) =>
                            setSuggestionSearchKeyword(e.target.value)
                          }
                        />
                        <label className="ao-suggestion-pool__archived-toggle">
                          <input
                            type="checkbox"
                            checked={showArchivedSuggestions}
                            onChange={(e) =>
                              setShowArchivedSuggestions(e.target.checked)
                            }
                          />
                          显示归档
                        </label>
                      </div>
                    </div>

                    {visibleSuggestions.length > 0 ? (
                      <div className="ao-suggestion-pool__list">
                        {visibleSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className={`ao-pool-card ${
                              suggestion.selected
                                ? "ao-pool-card--selected"
                                : ""
                            }`}
                            onClick={() =>
                              toggleSuggestionSelection(suggestion.id)
                            }
                          >
                            <div className="ao-pool-card__header">
                              <div
                                className={`ao-pool-card__checkbox ${
                                  suggestion.selected
                                    ? "ao-pool-card__checkbox--checked"
                                    : ""
                                }`}
                              >
                                {suggestion.selected && <CheckIcon />}
                              </div>
                              <span
                                className={`ao-pool-card__tag ao-pool-card__tag--${suggestion.category}`}
                              >
                                {categoryLabels[suggestion.category]}
                              </span>
                              <span
                                className="ao-pool-card__title"
                                title={suggestion.title}
                              >
                                {suggestion.title}
                              </span>
                              <div className="ao-pool-card__actions">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSuggestionId(
                                      editingSuggestionId === suggestion.id
                                        ? null
                                        : suggestion.id,
                                    );
                                  }}
                                  title="编辑备注"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  disabled={suggestion.selected}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archiveSuggestion(suggestion.id);
                                  }}
                                  title={
                                    suggestion.selected
                                      ? "已选建议不可归档"
                                      : "归档"
                                  }
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </div>
                            <div
                              className={`ao-pool-card__content ${
                                expandedSuggestionIds.has(suggestion.id)
                                  ? "ao-pool-card__content--expanded"
                                  : ""
                              }`}
                              title={suggestion.fullContent}
                            >
                              {expandedSuggestionIds.has(suggestion.id)
                                ? suggestion.fullContent
                                : suggestion.content}
                            </div>
                            {suggestion.fullContent.length >
                              suggestion.content.length && (
                              <button
                                className="ao-pool-card__expand-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSuggestionIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(suggestion.id)) {
                                      next.delete(suggestion.id);
                                    } else {
                                      next.add(suggestion.id);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {expandedSuggestionIds.has(suggestion.id)
                                  ? "收起"
                                  : "展开"}
                              </button>
                            )}
                            {editingSuggestionId === suggestion.id && (
                              <div className="ao-pool-card__note">
                                <input
                                  type="text"
                                  placeholder="添加备注..."
                                  value={suggestion.note || ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    updateSuggestionNote(
                                      suggestion.id,
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ao-suggestion-pool__empty">
                        <LightbulbIcon />
                        {suggestionPool.length > 0 ? (
                          <>
                            <p>无匹配结果</p>
                            <p style={{ fontSize: "0.75rem" }}>
                              请修改搜索词或勾选“显示归档”
                            </p>
                          </>
                        ) : (
                          <>
                            <p>暂无建议</p>
                            <p style={{ fontSize: "0.75rem" }}>
                              与 AI 对话后，建议将自动出现在此处
                            </p>
                            <div className="ao-suggestion-pool__quick-actions">
                              <button onClick={handleStartAnalysis}>
                                分析当前图
                              </button>
                              <button
                                onClick={() =>
                                  handleSendPresetQuestion(PRESET_QUESTIONS[0])
                                }
                              >
                                填入示例问题
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Generation Console - Bottom */}
                  <div className="ao-generation-console">
                    <div className="ao-generation-console__style-selector">
                      <label>3. 选择架构风格</label>
                      <select
                        value={architectureStyle}
                        onChange={(e) =>
                          setArchitectureStyle(
                            e.target.value as ArchitectureStyle,
                          )
                        }
                      >
                        {(Object.keys(styleLabels) as ArchitectureStyle[]).map(
                          (style) => (
                            <option key={style} value={style}>
                              {styleLabels[style]}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="ao-generation-console__actions">
                      <button
                        className="ao-generation-console__generate-btn"
                        onClick={generateNewFromSelected}
                        disabled={
                          selectedSuggestions.length === 0 || isStreaming
                        }
                      >
                        <SparklesIcon />
                        {isStreaming ? "正在生成方案..." : "生成新方案"}
                      </button>
                      <button
                        className="ao-generation-console__update-btn"
                        onClick={updateCurrentFromSelected}
                        disabled={
                          selectedSuggestions.length === 0 ||
                          isStreaming ||
                          !activeSchemeId
                        }
                      >
                        更新当前方案
                      </button>
                    </div>
                    <div className="ao-generation-console__count">
                      {selectedSuggestions.length === 0
                        ? "请先选择至少 1 条建议"
                        : `已选 ${selectedSuggestions.length} 项建议（默认新建）`}
                    </div>
                  </div>
                </div>
              </>
            )}

            {isPreviewPage &&
              (activeScheme ? (
                <>
                  <div className="architecture-optimization-dialog__preview-toolbar">
                    <div className="architecture-optimization-dialog__scheme-title">
                      <label htmlFor="scheme-title">方案名称</label>
                      <input
                        id="scheme-title"
                        type="text"
                        value={activeScheme.title || ""}
                        onChange={(e) =>
                          handleRenameScheme(activeScheme.id, e.target.value)
                        }
                        placeholder="为方案起个名字"
                      />
                    </div>
                    <div className="architecture-optimization-dialog__compare-switch">
                      <span>对比模式</span>
                      <Switch
                        name="compare-mode"
                        checked={isCompareMode}
                        onChange={handleToggleCompare}
                        disabled={elements.length === 0}
                      />
                    </div>
                  </div>

                  <div className="architecture-optimization-dialog__result-preview">
                    <h4>新架构预览 (Mermaid)</h4>
                    <div
                      className={`architecture-optimization-dialog__preview-grid ${
                        isCompareMode
                          ? "architecture-optimization-dialog__preview-grid--compare"
                          : ""
                      }`}
                    >
                      <div className="architecture-optimization-dialog__preview-card">
                        <div className="architecture-optimization-dialog__preview-label">
                          当前方案
                        </div>
                        <div
                          className="architecture-optimization-dialog__preview-canvas ao-canvas-blueprint"
                          style={{
                            cursor: isPanMode ? "grab" : "default",
                            touchAction: isPanMode ? "none" : "auto",
                          }}
                          onPointerDown={handlePreviewPointerDown}
                          onPointerMove={handlePreviewPointerMove}
                          onPointerUp={handlePreviewPointerUp}
                          onPointerCancel={handlePreviewPointerUp}
                        >
                          <div
                            ref={previewCanvasRef}
                            className="architecture-optimization-dialog__preview-canvas-inner"
                            style={{
                              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                              transformOrigin: "center center",
                              transition: "transform 150ms ease-out",
                            }}
                          />
                          <div
                            className="architecture-optimization-dialog__canvas-toolbar"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <button title="放大" onClick={handleZoomIn}>
                              <ZoomInIcon />
                            </button>
                            <button title="缩小" onClick={handleZoomOut}>
                              <ZoomOutIcon />
                            </button>
                            <div className="architecture-optimization-dialog__canvas-toolbar__divider" />
                            <button
                              title="平移"
                              onClick={handleTogglePanMode}
                              aria-pressed={isPanMode}
                            >
                              <MoveIcon />
                            </button>
                            <button title="适应画布" onClick={handleFitCanvas}>
                              <MaximizeIcon />
                            </button>
                          </div>
                          {previewError && (
                            <div className="architecture-optimization-dialog__preview-error">
                              <div>无法渲染预览：{previewError.message}</div>
                              {activeScheme?.mermaid && (
                                <pre className="architecture-optimization-dialog__preview-error-mermaid">
                                  {activeScheme.mermaid}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isCompareMode && (
                        <div className="architecture-optimization-dialog__preview-card">
                          <div className="architecture-optimization-dialog__preview-label">
                            原架构图
                          </div>
                          <div className="architecture-optimization-dialog__preview-canvas">
                            <div
                              ref={originalPreviewCanvasRef}
                              className="architecture-optimization-dialog__preview-canvas-inner"
                            />
                            {originalPreviewError && (
                              <div className="architecture-optimization-dialog__preview-error">
                                <div>
                                  无法渲染原架构图：
                                  {originalPreviewError.message}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Floating Suggestion Drawer */}
                  <div
                    className={`ao-drawer ${
                      isDrawerOpen ? "ao-drawer--open" : ""
                    }`}
                  >
                    <div className="ao-drawer__header">
                      <h3>
                        <SparklesIcon />
                        优化建议
                      </h3>
                      <button
                        className="ao-drawer__close"
                        onClick={() => setIsDrawerOpen(false)}
                      >
                        <XIcon />
                      </button>
                    </div>
                    <div className="ao-drawer__content">
                      {parseSuggestions(activeScheme.summary).length > 0 ? (
                        parseSuggestions(activeScheme.summary).map(
                          (suggestion) => {
                            const isApplied = suggestionPool.some(
                              (item) =>
                                item.selected &&
                                item.content.slice(0, 50) ===
                                  compactSuggestionContent(
                                    suggestion.content,
                                  ).slice(0, 50),
                            );
                            return (
                              <div
                                key={suggestion.id}
                                className={`ao-suggestion-card ${
                                  highlightedSuggestionId === suggestion.id
                                    ? "ao-suggestion-card--highlighted"
                                    : ""
                                }`}
                              >
                                <div className="ao-suggestion-card__header">
                                  <span
                                    className={`ao-suggestion-card__tag ao-suggestion-card__tag--${suggestion.category}`}
                                  >
                                    {categoryLabels[suggestion.category]}
                                  </span>
                                </div>
                                <div className="ao-suggestion-card__content">
                                  {suggestion.content}
                                </div>
                                <button
                                  className="ao-suggestion-card__apply"
                                  disabled={isApplied}
                                  title={
                                    isApplied
                                      ? "该建议已应用"
                                      : "应用到已选建议"
                                  }
                                  onClick={() => {
                                    if (isApplied) {
                                      return;
                                    }
                                    applySuggestionToPool(suggestion);
                                    setHighlightedSuggestionId(suggestion.id);
                                    // Clear highlight after 2 seconds
                                    setTimeout(
                                      () => setHighlightedSuggestionId(null),
                                      2000,
                                    );
                                  }}
                                >
                                  <SparklesIcon />
                                  {isApplied ? "已应用" : "应用"}
                                </button>
                              </div>
                            );
                          },
                        )
                      ) : (
                        <div className="ao-suggestion-card">
                          <div className="ao-suggestion-card__content">
                            {activeScheme.summary || "暂无建议"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="architecture-optimization-dialog__empty">
                  <div className="architecture-optimization-dialog__empty-content">
                    <p>暂无方案，请从建议页重新生成。</p>
                    <div className="architecture-optimization-dialog__empty-actions">
                      <button
                        className="architecture-optimization-dialog__button--secondary"
                        onClick={() => setIsPreviewPage(false)}
                      >
                        返回建议页
                      </button>
                      <button
                        className="architecture-optimization-dialog__button--primary"
                        onClick={handleGeneratePlan}
                        disabled={isStreaming || messages.length === 0}
                      >
                        {isStreaming ? "生成中..." : "直接生成新方案"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {isPreviewPage && activeScheme && (
              <div className="architecture-optimization-dialog__preview-actions">
                <button
                  onClick={() =>
                    activeScheme ? insertSchemeToCanvas(activeScheme) : null
                  }
                  className="architecture-optimization-dialog__button--primary"
                  disabled={
                    !activeScheme || renderingSchemes.has(activeScheme.id)
                  }
                >
                  {renderingSchemes.has(activeScheme?.id || "")
                    ? "正在准备..."
                    : "插入到主图旁"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
