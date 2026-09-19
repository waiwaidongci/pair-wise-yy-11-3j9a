// ============================================================
// 界面：充填队列 —— 当班充填单流转、返工与清洗待办
// ============================================================

import { useState } from "react";
import { isInspectionOverdue, tankOf } from "../domain/rules";
import type { AppState } from "../domain/types";
import { fmtTime, FILL_STATUS_TEXT, mixLabel, today } from "./format";

interface Props {
  state: AppState;
  onStart: (fillId: string) => void;
  onComplete: (fillId: string) => void;
  onSign: (fillId: string) => void;
  onOpenRework: (fillId: string, reason: string) => void;
  onCloseRework: (ticketId: string) => void;
  onCreateCleaning: (tankId: string) => void;
  onDoneCleaning: (orderId: string) => void;
}

export function FillQueue({
  state,
  onStart,
  onComplete,
  onSign,
  onOpenRework,
  onCloseRework,
  onCreateCleaning,
  onDoneCleaning,
}: Props) {
  const [reworkFor, setReworkFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const current = state.shifts.find((s) => s.status !== "locked");
  const fills = current ? state.fills.filter((f) => f.shiftId === current.id) : [];
  const openReworks = state.reworks.filter((r) => r.status === "open");
  const pendingCleanings = state.cleanings.filter((c) => c.status === "pending");
  const locked = current?.status === "handing_over";

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>待充填队列</p>
          <h2>当班充填单（{fills.length}）</h2>
        </div>
        {locked && <span className="badge shift-handing_over">交接中，操作已冻结</span>}
      </div>

      {fills.length === 0 && <p className="muted">当班暂无充填单。</p>}

      <div className="records">
        {fills.map((f) => {
          const tank = tankOf(state, f.tankId);
          const overdue = tank ? isInspectionOverdue(tank, today()) : false;
          return (
            <article key={f.id} className="fill-row">
              <div className="fill-main">
                <h3>
                  {tank?.code ?? f.tankId}
                  <span className={`badge st-${f.status}`}>{FILL_STATUS_TEXT[f.status]}</span>
                  {overdue && <span className="badge warn">检验过期</span>}
                </h3>
                <p>
                  {tank?.volume} · 残压 {f.residualBar}bar → 目标 {f.targetBar}bar ·{" "}
                  {mixLabel(f.o2, f.he)} · {f.equipmentId} · {f.operator} · 登记{" "}
                  {fmtTime(f.createdAt)}
                </p>
                {reworkFor === f.id && (
                  <div className="inline-form">
                    <input
                      autoFocus
                      value={reason}
                      placeholder="返工原因"
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="primary"
                      onClick={() => {
                        onOpenRework(f.id, reason);
                        setReworkFor(null);
                        setReason("");
                      }}
                    >
                      提交
                    </button>
                    <button onClick={() => setReworkFor(null)}>取消</button>
                  </div>
                )}
              </div>
              {!locked && (
                <div className="actions">
                  {f.status === "queued" && (
                    <>
                      <button className="primary" onClick={() => onStart(f.id)}>开始充填</button>
                      <button onClick={() => onCreateCleaning(f.tankId)}>生成清洗单</button>
                    </>
                  )}
                  {f.status === "filling" && (
                    <button className="primary" onClick={() => onComplete(f.id)}>完成充填</button>
                  )}
                  {f.status === "filled" && (
                    <>
                      <button className="primary" onClick={() => onSign(f.id)}>签收</button>
                      <button onClick={() => setReworkFor(f.id)}>发起返工</button>
                    </>
                  )}
                  {f.status === "signed" && (
                    <button onClick={() => setReworkFor(f.id)}>发起返工</button>
                  )}
                  {f.status === "rework" && <span className="muted">待返工关闭</span>}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {(openReworks.length > 0 || pendingCleanings.length > 0) && (
        <div className="todo">
          <h3>未了事项（不处理不得交班）</h3>
          {openReworks.map((r) => {
            const fill = state.fills.find((f) => f.id === r.fillId);
            const tank = fill ? tankOf(state, fill.tankId) : undefined;
            return (
              <div key={r.id} className="todo-row">
                <span>
                  返工单 {r.id} · {tank?.code ?? r.fillId} · {r.reason}
                </span>
                {!locked && <button onClick={() => onCloseRework(r.id)}>关闭返工</button>}
              </div>
            );
          })}
          {pendingCleanings.map((c) => {
            const tank = tankOf(state, c.tankId);
            return (
              <div key={c.id} className="todo-row">
                <span>
                  清洗单 {c.id} · {tank?.code ?? c.tankId} · {c.note}
                </span>
                {!locked && <button onClick={() => onDoneCleaning(c.id)}>标记已处理</button>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
