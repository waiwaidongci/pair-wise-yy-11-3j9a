import { useCallback, useEffect, useState } from "react";
import { AppState } from "./domain/types";
import { RuleResult } from "./domain/rules";
import { useStore } from "./ui/useStore";
import { MetricsBar } from "./ui/MetricsBar";
import { FillWorkbench } from "./ui/FillWorkbench";
import { InspectionReminders, NewFillForm } from "./ui/NewFillForm";
import { HandoverPanel } from "./ui/HandoverPanel";
import { TankHistory } from "./ui/TankHistory";
import { fmtTime } from "./ui/format";
import "./styles.css";

function App() {
  const { state, dispatch, reset } = useStore();
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = useCallback(
    (rule: (s: AppState) => RuleResult) => {
      const res = dispatch(rule);
      setFlash(res.ok ? { kind: "ok", text: res.message } : { kind: "err", text: res.error });
      return res;
    },
    [dispatch],
  );

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const currentShift = state.shifts.find((s) => s.id === state.currentShiftId);
  const pendingSheet = state.handovers.find(
    (h) => h.fromShiftId === state.currentShiftId && h.status === "pending",
  );

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62010 · Port 62010 · 规则 / 存储 / 界面 分层实现</p>
        <h1>潜水气瓶充填 · 班次交接闭环</h1>
        <span>
          收班时进行中充填连同气瓶、设备、操作员一并移交接班人；返工未关闭、气瓶未签收或清洗单未处理不得交班；
          接班确认后当班记录锁定，漏记在下一班登记更正，旧班快照永久保留。
        </span>
        <div className="shift-bar">
          {currentShift && (
            <span className="shift-chip">
              当前班次：{currentShift.label} · 操作员 {currentShift.operator} ·{" "}
              {fmtTime(currentShift.startedAt)} 开班
            </span>
          )}
          {pendingSheet && <span className="shift-chip pending">交接单待确认</span>}
          <button
            className="ghost"
            onClick={() => {
              if (window.confirm("重置为初始演示数据？当前所有记录将被清除。")) reset();
            }}
          >
            重置演示数据
          </button>
        </div>
      </section>

      {flash && (
        <div className={`flash ${flash.kind}`} onClick={() => setFlash(null)}>
          {flash.text}
        </div>
      )}

      <MetricsBar state={state} />

      <section className="workspace">
        <FillWorkbench state={state} run={run} />
        <aside className="side">
          <NewFillForm key={currentShift?.id ?? "none"} state={state} run={run} />
          <InspectionReminders state={state} />
        </aside>
      </section>

      <HandoverPanel state={state} run={run} />
      <TankHistory state={state} run={run} />
    </main>
  );
}

export default App;
