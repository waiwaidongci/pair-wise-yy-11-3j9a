// ============================================================
// 界面：班次面板 —— 当班信息、发起交班、交接单与接班确认
// ============================================================

import { useState } from "react";
import { handoverBlockers } from "../domain/rules";
import type { AppState } from "../domain/types";
import { fmtTime, SHIFT_STATUS_TEXT } from "./format";

interface Props {
  state: AppState;
  onRequestHandover: (toOperator: string) => void;
  onConfirm: (shiftId: string, token: string) => void;
}

export function ShiftPanel({ state, onRequestHandover, onConfirm }: Props) {
  const [toOperator, setToOperator] = useState("");
  const current = state.shifts.find((s) => s.status !== "locked");
  const blockers = handoverBlockers(state);

  if (!current) return null;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>班次交接</p>
          <h2>
            {current.label}
            <span className={`badge shift-${current.status}`}>{SHIFT_STATUS_TEXT[current.status]}</span>
          </h2>
        </div>
      </div>

      <dl className="meta">
        <div>
          <dt>当班操作员</dt>
          <dd>{current.operator}</dd>
        </div>
        <div>
          <dt>开班时间</dt>
          <dd>{fmtTime(current.startedAt)}</dd>
        </div>
      </dl>

      {current.status === "active" && (
        <div className="handover-box">
          {blockers.length > 0 ? (
            <div className="blockers">
              <b>暂不可交班，需先处理：</b>
              <ul>
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="ok-text">无未了事项，可以交班。</p>
          )}
          <label>
            <span>接班人</span>
            <input
              value={toOperator}
              placeholder="填写接班人姓名"
              onChange={(e) => setToOperator(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={blockers.length > 0 || !toOperator.trim()}
            onClick={() => onRequestHandover(toOperator.trim())}
          >
            发起交班（生成交接单）
          </button>
        </div>
      )}

      {current.status === "handing_over" && current.handover && (
        <div className="slip">
          <h3>交接单 {current.handover.id}</h3>
          <p className="slip-line">
            {current.handover.fromOperator} → <b>{current.handover.toOperator}</b> ·{" "}
            {fmtTime(current.handover.createdAt)} 生成
          </p>
          {current.handover.items.length === 0 ? (
            <p className="muted">本班无进行中的充填，空班交接。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>充填单</th>
                  <th>气瓶</th>
                  <th>设备</th>
                  <th>原操作员</th>
                </tr>
              </thead>
              <tbody>
                {current.handover.items.map((item) => (
                  <tr key={item.fillId}>
                    <td>{item.fillId}</td>
                    <td>{item.tankCode}</td>
                    <td>{item.equipmentId}</td>
                    <td>{item.fromOperator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            className="primary"
            onClick={() => onConfirm(current.id, current.handover!.confirmToken)}
          >
            接班确认（{current.handover.toOperator}）
          </button>
          <p className="muted">确认后当班记录锁定，漏记只能在下一班登记更正；重复确认不会生效。</p>
        </div>
      )}
    </section>
  );
}
