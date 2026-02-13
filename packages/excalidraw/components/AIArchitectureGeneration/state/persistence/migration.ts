/**
 * 数据迁移层
 * 支持从旧格式数据迁移到新格式
 */

import type { AIArchitectureGenerationSessionState } from "../../types";
import { DEFAULT_SESSION_STATE } from "../../types";

/** 迁移结果 */
interface MigrationResult {
  success: boolean;
  data?: AIArchitectureGenerationSessionState;
  error?: string;
  backup?: unknown;
}

/** 检测数据版本 */
export function detectVersion(data: unknown): number {
  if (typeof data !== "object" || data === null) {
    return 0;
  }
  
  const obj = data as Record<string, unknown>;
  
  // 检查是否有版本号字段
  if (typeof obj.version === "number") {
    return obj.version;
  }
  
  // 旧版本检测逻辑
  if (obj.step && typeof obj.step === "string") {
    // v1 的特征
    return 1;
  }
  
  return 0;
}

const VALID_STEPS: ReadonlyArray<AIArchitectureGenerationSessionState["step"]> = [
  "ingest",
  "fieldConfirm",
  "issueResolve",
  "draftConfirm",
];

const VALID_MODES: ReadonlyArray<AIArchitectureGenerationSessionState["mode"]> = [
  "safe",
  "advanced",
];

/** 确保 v3 数据合法，避免手工篡改导致崩溃 */
function sanitizeV3State(
  data: unknown,
): AIArchitectureGenerationSessionState {
  if (typeof data !== "object" || data === null) {
    return DEFAULT_SESSION_STATE;
  }
  const record = data as Record<string, unknown>;
  const step = VALID_STEPS.includes(record.step as AIArchitectureGenerationSessionState["step"])
    ? (record.step as AIArchitectureGenerationSessionState["step"])
    : DEFAULT_SESSION_STATE.step;
  const mode = VALID_MODES.includes(record.mode as AIArchitectureGenerationSessionState["mode"])
    ? (record.mode as AIArchitectureGenerationSessionState["mode"])
    : DEFAULT_SESSION_STATE.mode;
  const draftFilter =
    typeof record.draftFilter === "string"
      ? record.draftFilter
      : DEFAULT_SESSION_STATE.draftFilter;
  const namingSuggestions =
    typeof record.namingSuggestions === "object" &&
    record.namingSuggestions !== null
      ? (record.namingSuggestions as Record<string, string[]>)
      : DEFAULT_SESSION_STATE.namingSuggestions;

  return {
    step,
    mode,
    draftFilter,
    namingSuggestions,
    version: 3,
  };
}

/** 迁移会话状态 */
export function migrateSessionState(
  oldData: unknown,
  source: string = "localStorage",
): MigrationResult {
  const version = detectVersion(oldData);
  
  // 备份原始数据
  const backup = JSON.parse(JSON.stringify(oldData));
  
  try {
    switch (version) {
      case 3:
        // 已经是最新版本
        return {
          success: true,
          data: sanitizeV3State(oldData),
          backup,
        };

      case 2:
      case 1:
        // 破坏性改版：v1/v2 直接重置为默认 v3 会话
        console.warn(
          `[AIArchitecture] 检测到旧版会话，按策略重置为默认状态。来源: ${source}`,
        );
        return {
          success: true,
          data: DEFAULT_SESSION_STATE,
          backup,
        };

      case 0:
      default:
        // 无法识别，使用默认值
        console.warn(`[AIArchitecture] 无法识别的数据版本，使用默认值。来源: ${source}`);
        return {
          success: true,
          data: DEFAULT_SESSION_STATE,
          backup,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      backup,
    };
  }
}

/** 存储键映射 */
const STORAGE_KEY_MAPPING: Record<string, string> = {
  // 会话键
  "excalidraw_ai_arch_generation_session": "excalidraw_ai_arch_generation_session_v2",
  "excalidraw_ai_arch_generation_session_v2": "excalidraw_ai_arch_generation_session_v3",

  // 旧数据键（v3 不做自动迁移，统一清理）
  "excalidraw_ai_arch_gen_source": "excalidraw_ai_arch_gen_v2_source",
  "excalidraw_ai_arch_gen_mapping": "excalidraw_ai_arch_gen_v2_mapping",
  "excalidraw_ai_arch_gen_edits": "excalidraw_ai_arch_gen_v2_edits",
  "excalidraw_ai_arch_gen_ignored": "excalidraw_ai_arch_gen_v2_ignored",
  "excalidraw_ai_arch_gen_aliases": "excalidraw_ai_arch_gen_v2_aliases",
  "excalidraw_ai_arch_gen_v2_source": "",
  "excalidraw_ai_arch_gen_v2_mapping": "",
  "excalidraw_ai_arch_gen_v2_edits": "",
  "excalidraw_ai_arch_gen_v2_ignored": "",
  "excalidraw_ai_arch_gen_v2_aliases": "",
};

/** 迁移localStorage数据 */
export function migrateLocalStorage(): void {
  if (typeof window === "undefined") return;

  let shouldResetSession = false;
  Object.keys(STORAGE_KEY_MAPPING).forEach((oldKey) => {
    try {
      const oldData = window.localStorage.getItem(oldKey);
      if (!oldData) {
        return;
      }
      if (
        oldKey === "excalidraw_ai_arch_generation_session" ||
        oldKey === "excalidraw_ai_arch_generation_session_v2"
      ) {
        shouldResetSession = true;
      }
    } catch (e) {
      console.error(`[AIArchitecture] 迁移失败 ${oldKey}:`, e);
    }
  });

  if (shouldResetSession) {
    window.localStorage.setItem(
      "excalidraw_ai_arch_generation_session_v3",
      JSON.stringify(DEFAULT_SESSION_STATE),
    );
    console.log("[AIArchitecture] 已重置会话到 v3 默认状态");
  }

  cleanupOldStorage();
}

/** 清理旧数据 */
export function cleanupOldStorage(): void {
  if (typeof window === "undefined") return;

  Object.keys(STORAGE_KEY_MAPPING).forEach((oldKey) => {
    try {
      window.localStorage.removeItem(oldKey);
      console.log(`[AIArchitecture] 已清理旧数据: ${oldKey}`);
    } catch (e) {
      console.error(`[AIArchitecture] 清理失败 ${oldKey}:`, e);
    }
  });
}
