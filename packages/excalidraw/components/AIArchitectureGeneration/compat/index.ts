/**
 * 向后兼容层
 * 仅保留本次迁移需要的初始化逻辑
 */

import { migrateLocalStorage } from "../state/persistence";

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/** 初始化兼容层 */
export function initCompatibilityLayer(): void {
  if (isDev) {
    console.log("[AIArchitecture] 初始化向后兼容层...");
  }

  const storage =
    typeof window !== "undefined"
      ? (window.localStorage as Storage | undefined)
      : undefined;
  const canUseStorage =
    !!storage &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function";

  if (canUseStorage) {
    migrateLocalStorage();
  }

  if (isDev) {
    console.log("[AIArchitecture] 向后兼容层初始化完成");
  }
}
