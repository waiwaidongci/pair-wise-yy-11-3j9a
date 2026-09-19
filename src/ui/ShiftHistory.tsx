// ============================================================
// 界面：历史班次快照与锁定后更正登记
// ============================================================

import { useMemo, useState } from "react";
import type { AppState } from "../domain/types";
import { fmtTime, FILL_STATUS_TEXT, mixLabel } from "./format";

interface Props {
  state: AppState;
  /** 返回 true 表示登记成功 */
  onAddCorrection: (shiftId: string, fillId: string, detail: string, author: string) => boolean;
}

export function ShiftHistory({ state, onAddCorrection }: Props) {
  const locked = state.shifts.filter((s) => s.status === "locked");
  const [shiftId, setShiftId] = useState("");
  const [fillId, setFillId] = useState("");
  const [detail, setDetail] = useState("");
  const [author, setAuthor] = useState("");

  const shiftFills = useMemo(
    () => state.fills.filter((f) => f.shiftId === shiftId),
    [state.fills, shiftId]
  );

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>历史快照</p>
          <h2>已锁定班次（{locked.length}）</h2>
        </div>
      </div>

      {locked.length === 0 && <p className="muted">尚无锁定班次，完成一次接班确认后在此留档。</p>}

      {locked.map((s) => (
        <div key={s.id} className="snapshot">
          <h3>
            {s.id} · {s.label} · {s.operator}
            <span className="badge shift-locked">已锁定</span>
          </h3>
          <p className="muted">
            锁定于 {fmtTime(s.lockedAt)}
            {s.handover &&
              ` · 交接单 ${s.handover.id}（${s.handover.fromOperator} → ${s.handover.toOperator}，移交 ${s.handover.items.length} 项在制充填，${fmtTime(
                s.handover.confirmedAt
              )} 确认）`}
          </p>
        </div>
      ))}

      {locked.length > 0 && (
        <div className="correction">
          <h3>漏记更正（仅针对已锁定班次，不改快照）</h3>
          <div className="field-grid">
            <label>
              <span>锁定班次</span>
              <select
                value={shiftId}
                onChange={(e) => {
                  setShiftId(e.target.value);
                  setFillId("");
                }}
              >
                <option value="">选择班次</option>
                {locked.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.label} · {s.operator}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>充填单</span>
              <select value={fillId} onChange={(e) => setFillId(e.target.value)}>
                <option value="">选择充填单</option>
                {shiftFills.map((f) => {
                  const tank = state.tanks.find((t) => t.id === f.tankId);
                  return (
                    <option key={f.id} value={f.id}>
                      {f.id} · {tank?.code} · {mixLabel(f.o2, f.he)} · {FILL_STATUS_TEXT[f.status]}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              <span>更正内容</span>
              <input
                value={detail}
                placeholder="如：漏记残压，实际为 45bar"
                onChange={(e) => setDetail(e.target.value)}
              />
            </label>
            <label>
              <span>更正人</span>
              <input value={author} placeholder="填写姓名" onChange={(e) => setAuthor(e.target.value)} />
            </label>
          </div>
          <button
            className="primary"
            disabled={!shiftId || !fillId || !detail.trim() || !author.trim()}
            onClick={() => {
              if (onAddCorrection(shiftId, fillId, detail, author)) {
                setDetail("");
              }
            }}
          >
            登记更正
          </button>

          {state.corrections.length > 0 && (
            <ul className="correction-list">
              {state.corrections.map((c) => (
                <li key={c.id}>
                  <b>{c.id}</b> · {c.shiftId} / {c.fillId} · {c.detail} · {c.author} ·{" "}
                  {fmtTime(c.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
