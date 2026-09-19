// ============================================================
// 界面桥接：React 状态 ←→ 存储层。存储是唯一事实来源：
// 每次 dispatch 从 localStorage 读最新已提交状态 → 纯函数规则
// 计算 → 单事务写回。重复点击或另一标签页的并发确认，都会
// 在规则层读到“已确认”而被拒绝，保证同一班次只成功一次。
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { AppState } from "../domain/types";
import { RuleResult } from "../domain/rules";
import { applyResult, loadState, resetState, subscribeExternalChanges } from "../data/storage";

export function useStore() {
  const [state, setState] = useState<AppState>(loadState);

  // 多标签页同步：另一个标签页确认交接后，本页立即刷新为一致状态
  useEffect(() => subscribeExternalChanges(setState), []);

  const dispatch = useCallback((rule: (s: AppState) => RuleResult): RuleResult => {
    const result = applyResult(rule(loadState()));
    if (result.ok) setState(result.state);
    return result;
  }, []);

  const reset = useCallback(() => setState(resetState()), []);

  return { state, dispatch, reset };
}
