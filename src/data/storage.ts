// ============================================================
// 存储层：localStorage 持久化 + 单事务提交。
// 规则层产出新状态后由这里原子写入；刷新后队列、交接单、
// 单瓶历史从同一份状态恢复，保证一致。
// ============================================================

import { AppState } from "../domain/types";
import { RuleResult } from "../domain/rules";
import { seedState } from "./seed";

const STORAGE_KEY = "hxyfront-62010:state:v1";

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) throw new Error("unknown state version");
    return parsed;
  } catch {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }
}

export function saveState(state: AppState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 单事务应用规则：localStorage 写入是同步的，
 * 同标签页内重复点击、并发事件只会有一个先完成提交，
 * 后到者在规则层读到已提交状态（如交接单已 confirmed）而被拒绝。
 */
export function applyResult(result: RuleResult): RuleResult {
  if (result.ok) saveState(result.state);
  return result;
}

export function resetState(): AppState {
  const seeded = seedState();
  saveState(seeded);
  return seeded;
}

export function subscribeExternalChanges(onChange: (state: AppState) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange(loadState());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
