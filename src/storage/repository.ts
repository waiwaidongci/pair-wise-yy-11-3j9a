// ============================================================
// 存储层：localStorage 持久化。
// 队列、交接单、单瓶历史等全部状态落盘，刷新后保持一致。
// ============================================================

import { seedState } from "../domain/seed";
import type { AppState } from "../domain/types";

const STORAGE_KEY = "hxyfront-62010:shift-loop:v1";

function isValidState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    Array.isArray(s.tanks) &&
    Array.isArray(s.fills) &&
    Array.isArray(s.reworks) &&
    Array.isArray(s.cleanings) &&
    Array.isArray(s.shifts) &&
    Array.isArray(s.corrections) &&
    typeof s.seq === "number"
  );
}

/** 读取状态；无存档或存档损坏时回退到种子数据 */
export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState(new Date().toISOString());
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return seedState(new Date().toISOString());
    return parsed;
  } catch {
    return seedState(new Date().toISOString());
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用（隐私模式等）时静默降级为内存态
  }
}

/** 清空存档并返回新的种子状态 */
export function resetState(): AppState {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return seedState(new Date().toISOString());
}
