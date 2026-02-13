/**
 * 数据迁移层
 * 支持从旧格式数据迁移到新格式
 */

import type { AIArchitectureGenerationSessionState } from "../../types";
import { DEFAULT_SESSION_STATE } from "../../types";

/** 旧版本会话状态 (v1) */
interface OldSessionStateV1 {
  step: string;
  mode: string;
  draftFilter: string;
  namingSuggestions: Record<string, string[]>;
  // 可能还有其他旧字段
}

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

/** 从v1迁移到v2 */
function migrateV1ToV2(oldData: OldSessionStateV1): AIArchitectureGenerationSessionState {
  // 验证必要字段
  const validSteps = ["import", "mapping", "issues", "draft", "calibrate"];
  const step = validSteps.includes(oldData.step) 
    ? (oldData.step as AIArchitectureGenerationSessionState["step"])
    : "import";
    
  const validModes = ["safe", "advanced"];
  const mode = validModes.includes(oldData.mode)
    ? (oldData.mode as AIArchitectureGenerationSessionState["mode"])
    : "safe";
  
  return {
    step,
    mode,
    draftFilter: oldData.draftFilter || "",
    namingSuggestions: oldData.namingSuggestions || {},
    version: 2,
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
      case 2:
        // 已经是最新版本
        return {
          success: true,
          data: oldData as AIArchitectureGenerationSessionState,
          backup,
        };
        
      case 1:
        // 从v1迁移
        return {
          success: true,
          data: migrateV1ToV2(oldData as OldSessionStateV1),
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
  // 旧键 -> 新键
  "excalidraw_ai_arch_generation_session": "excalidraw_ai_arch_generation_session_v2",
  "excalidraw_ai_arch_gen_source": "excalidraw_ai_arch_gen_v2_source",
  "excalidraw_ai_arch_gen_mapping": "excalidraw_ai_arch_gen_v2_mapping",
  "excalidraw_ai_arch_gen_edits": "excalidraw_ai_arch_gen_v2_edits",
  "excalidraw_ai_arch_gen_ignored": "excalidraw_ai_arch_gen_v2_ignored",
  "excalidraw_ai_arch_gen_aliases": "excalidraw_ai_arch_gen_v2_aliases",
};

/** 迁移localStorage数据 */
export function migrateLocalStorage(): void {
  if (typeof window === "undefined") return;
  
  Object.entries(STORAGE_KEY_MAPPING).forEach(([oldKey, newKey]) => {
    try {
      const oldData = window.localStorage.getItem(oldKey);
      if (oldData) {
        const parsed = JSON.parse(oldData);
        const migrated = migrateSessionState(parsed, oldKey);
        
        if (migrated.success && migrated.data) {
          // 保存到新键
          window.localStorage.setItem(newKey, JSON.stringify(migrated.data));
          console.log(`[AIArchitecture] 已迁移: ${oldKey} -> ${newKey}`);
        }
      }
    } catch (e) {
      console.error(`[AIArchitecture] 迁移失败 ${oldKey}:`, e);
    }
  });
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
