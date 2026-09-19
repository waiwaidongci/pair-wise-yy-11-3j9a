// ============================================================
// 组合层：状态持有 + 规则调用 + 存储同步 + 界面组装
// 业务判断全部在 domain/rules，持久化全部在 storage/repository。
// ============================================================

import { useEffect, useState } from "react";
import {
  addCorrection,
  closeRework,
  completeFill,
  confirmHandover,
  createCleaning,
  doneCleaning,
  openRework,
  registerFill,
  requestHandover,
  signFill,
  startFill,
  type NewFillInput,
  type RuleResult,
} from "./domain/rules";
import type { AppState } from "./domain/types";
import { loadState, resetState, saveState } from "./storage/repository";
import { FillForm } from "./ui/FillForm";
import { FillQueue } from "./ui/FillQueue";
import { nowIso } from "./ui/format";
import { ShiftHistory } from "./ui/ShiftHistory";
import { ShiftPanel } from "./ui/ShiftPanel";
import { TankHistory } from "./ui/TankHistory";
import "./styles.css";

const project = { id: "hxyfront-62010", sourceNo: 5, port: 62010, title: "潜水气瓶充填记录" };

type Notice = { kind: "ok" | "err"; text: string } | null;

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [notice, setNotice] = useState<Notice>(null);

  // 任何状态变化立即落盘：队列、交接单、单瓶历史刷新后一致
  useEffect(() => {
    saveState(state);
  }, [state]);

  const apply = (result: RuleResult, okMsg: string): boolean => {
    if (result.ok) {
      setState(result.state);
      setNotice({ kind: "ok", text: okMsg });
      return true;
    }
    setNotice({ kind: "err", text: result.errors.join("；") });
    return false;
  };

  // ---- 充填流转 ----
  const onSubmitFill = (input: NewFillInput) =>
    apply(registerFill(state, input, nowIso()), `充填单已登记入队（${input.tankCode}）`);
  const onStart = (id: string) => apply(startFill(state, id, nowIso()), `${id} 开始充填`);
  const onComplete = (id: string) => apply(completeFill(state, id, nowIso()), `${id} 充填完成，待签收`);
  const onSign = (id: string) => apply(signFill(state, id, nowIso()), `${id} 已签收`);
  const onOpenRework = (id: string, reason: string) =>
    apply(openRework(state, id, reason, nowIso()), `${id} 已发起返工`);
  const onCloseRework = (id: string) =>
    apply(closeRework(state, id, nowIso()), `返工单 ${id} 已关闭，气瓶重新排队`);
  const onCreateCleaning = (tankId: string) =>
    apply(createCleaning(state, tankId, "充填前清洗", nowIso()), "清洗单已生成");
  const onDoneCleaning = (id: string) => apply(doneCleaning(state, id, nowIso()), `清洗单 ${id} 已处理`);

  // ---- 班次交接 ----
  const onRequestHandover = (toOperator: string) =>
    apply(requestHandover(state, toOperator, nowIso()), "交接单已生成，等待接班确认");

  const onConfirmHandover = (shiftId: string, token: string) => {
    const r = confirmHandover(state, shiftId, token, nowIso());
    if (r.ok) {
      setState(r.state);
      setNotice({ kind: "ok", text: "接班确认成功：旧班次已锁定，进行中充填已移交" });
    } else {
      // 重复/并发确认会走到这里（already=true），状态不变
      setNotice({ kind: "err", text: r.errors.join("；") });
    }
  };

  const onAddCorrection = (shiftId: string, fillId: string, detail: string, author: string) =>
    apply(addCorrection(state, shiftId, fillId, detail, author, nowIso()), "更正已登记到锁定班次");

  const onReset = () => {
    if (window.confirm("确定清空本地数据并恢复演示数据？")) {
      setState(resetState());
      setNotice({ kind: "ok", text: "已重置为演示数据" });
    }
  };

  // ---- 指标 ----
  const current = state.shifts.find((s) => s.status !== "locked");
  const currentFills = current ? state.fills.filter((f) => f.shiftId === current.id) : [];
  const metrics = [
    { label: "待充填", value: currentFills.filter((f) => f.status === "queued").length },
    { label: "充填中", value: currentFills.filter((f) => f.status === "filling").length },
    { label: "待签收", value: currentFills.filter((f) => f.status === "filled").length },
    {
      label: "未了事项",
      value:
        state.reworks.filter((r) => r.status === "open").length +
        state.cleanings.filter((c) => c.status === "pending").length,
    },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>
          {project.id} · 源提示词{project.sourceNo} · Port {project.port}
        </p>
        <h1>{project.title}</h1>
        <span>
          班次交接闭环：收班时进行中的充填连同气瓶、设备、操作员一并移交接班人；返工未关闭、气瓶未签收、
          清洗单未处理不得交班。接班确认后当班记录锁定，漏记只能在下一班登记更正，旧班快照永久保留。
        </span>
        <button className="ghost" onClick={onReset}>
          重置演示数据
        </button>
      </section>

      {notice && (
        <div className={`notice ${notice.kind}`} onClick={() => setNotice(null)}>
          {notice.text}
          <span className="muted">（点击关闭）</span>
        </div>
      )}

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="side">
          <ShiftPanel state={state} onRequestHandover={onRequestHandover} onConfirm={onConfirmHandover} />
          <FillForm state={state} onSubmit={onSubmitFill} />
        </aside>
        <FillQueue
          state={state}
          onStart={onStart}
          onComplete={onComplete}
          onSign={onSign}
          onOpenRework={onOpenRework}
          onCloseRework={onCloseRework}
          onCreateCleaning={onCreateCleaning}
          onDoneCleaning={onDoneCleaning}
        />
      </section>

      <section className="workspace bottom">
        <ShiftHistory state={state} onAddCorrection={onAddCorrection} />
        <TankHistory state={state} />
      </section>
    </main>
  );
}

export default App;
