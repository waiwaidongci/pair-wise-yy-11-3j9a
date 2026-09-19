import { useMemo, useState } from "react";
import { AppState, Shift } from "../domain/types";
import {
  computeBlockers,
  confirmHandover,
  createHandover,
  registerCorrection,
} from "../domain/rules";
import { STATUS_LABEL, fmtTime } from "./format";
import { PanelProps } from "./FillWorkbench";

const BLOCKER_ICON: Record<string, string> = {
  rework: "返工",
  unsigned: "签收",
  cleaning: "清洗",
};

function CorrectionForm({ state, run }: PanelProps) {
  const lockedShifts = state.shifts.filter((s) => s.status === "locked");
  const currentShift = state.shifts.find((s) => s.id === state.currentShiftId);
  const [targetShiftId, setTargetShiftId] = useState(lockedShifts[0]?.id ?? "");
  const [targetFillId, setTargetFillId] = useState("");
  const [note, setNote] = useState("");
  const [operator, setOperator] = useState(currentShift?.operator ?? "");

  const targetFills = state.fills.filter((f) => f.shiftId === targetShiftId);

  if (lockedShifts.length === 0) {
    return <p className="empty">暂无已锁定班次，无需更正</p>;
  }

  return (
    <div className="correction-form">
      <p className="hint-text">
        已锁定班次的漏记只能登记更正，更正计入当前班次「{currentShift?.label}」，原班记录与快照保持不变。
      </p>
      <div className="field-grid">
        <label>
          <span>目标班次（已锁定）</span>
          <select
            value={targetShiftId}
            onChange={(e) => {
              setTargetShiftId(e.target.value);
              setTargetFillId("");
            }}
          >
            {lockedShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}（{s.operator}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>关联充填记录（可选）</span>
          <select value={targetFillId} onChange={(e) => setTargetFillId(e.target.value)}>
            <option value="">不关联</option>
            {targetFills.map((f) => {
              const tank = state.tanks.find((t) => t.id === f.tankId);
              return (
                <option key={f.id} value={f.id}>
                  {tank?.code ?? f.tankId} · {STATUS_LABEL[f.status]}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span>登记人</span>
          <input value={operator} onChange={(e) => setOperator(e.target.value)} />
        </label>
        <label>
          <span>更正内容</span>
          <input
            placeholder="例如：漏记残压读数 / 签收人姓名补登"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <button
        className="primary"
        onClick={() =>
          run((s) =>
            registerCorrection(s, {
              targetShiftId,
              targetFillId: targetFillId || null,
              note,
              operator,
            }),
          )
        }
      >
        登记更正
      </button>
    </div>
  );
}

function LockedShiftCard({ state, shift }: { state: AppState; shift: Shift }) {
  const corrections = state.corrections.filter((c) => c.targetShiftId === shift.id);
  const shiftLabel = (id: string) => state.shifts.find((s) => s.id === id)?.label ?? id;
  const snap = shift.snapshot;

  return (
    <article className="locked-shift">
      <div className="fill-title">
        <h3>{shift.label}</h3>
        <span className="badge locked">已锁定</span>
      </div>
      <p>
        当班 {shift.operator} · {fmtTime(shift.startedAt)} 开班 → {fmtTime(shift.lockedAt)} 锁定 ·
        已签收 {snap?.signedCount ?? 0} 瓶
      </p>
      {snap && snap.signedFills.length > 0 && (
        <ul className="snapshot-list">
          {snap.signedFills.map((f) => (
            <li key={f.fillId}>
              <strong>{f.tankCode}</strong>：{f.summary}
            </li>
          ))}
        </ul>
      )}
      {corrections.length > 0 && (
        <div className="correction-list">
          <h4>下班更正（{corrections.length}）</h4>
          {corrections.map((c) => (
            <p key={c.id}>
              [{fmtTime(c.createdAt)}] {c.operator} 登记于「{shiftLabel(c.registeredInShiftId)}」：
              {c.note}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

export function HandoverPanel({ state, run }: PanelProps) {
  const [toOperator, setToOperator] = useState("");
  const blockers = useMemo(() => computeBlockers(state), [state]);
  const currentShift = state.shifts.find((s) => s.id === state.currentShiftId);
  const pendingSheet = state.handovers.find(
    (h) => h.fromShiftId === state.currentShiftId && h.status === "pending",
  );
  const confirmedSheets = state.handovers
    .filter((h) => h.status === "confirmed")
    .slice()
    .reverse();
  const lockedShifts = state.shifts
    .filter((s) => s.status === "locked")
    .slice()
    .reverse();
  const shiftLabel = (id: string) => state.shifts.find((s) => s.id === id)?.label ?? id;

  return (
    <section className="panel handover-panel">
      <div className="heading">
        <div>
          <p>班次交接闭环</p>
          <h2>交接班</h2>
        </div>
        {currentShift && (
          <span className="shift-chip">
            当前班次：{currentShift.label} · {currentShift.operator}
          </span>
        )}
      </div>

      <div className="handover-grid">
        <div>
          <h3 className="group-title">交班检查</h3>
          {blockers.length === 0 ? (
            <p className="ok-text">返工、签收、清洗单均已闭环，满足交班条件。</p>
          ) : (
            <ul className="blocker-list">
              {blockers.map((b, i) => (
                <li key={i}>
                  <span className="badge expired">{BLOCKER_ICON[b.type]}</span>
                  {b.message}
                </li>
              ))}
            </ul>
          )}

          {!pendingSheet && (
            <div className="inline-form handover-create">
              <input
                placeholder="接班人姓名"
                value={toOperator}
                onChange={(e) => setToOperator(e.target.value)}
              />
              <button
                className="primary"
                disabled={blockers.length > 0}
                title={blockers.length > 0 ? "存在未处理事项，不得交班" : ""}
                onClick={() => run((s) => createHandover(s, toOperator))}
              >
                收班并生成交接单
              </button>
            </div>
          )}

          {pendingSheet && (
            <div className="sheet">
              <h3 className="group-title">
                待确认交接单<em>{fmtTime(pendingSheet.createdAt)} 生成</em>
              </h3>
              <p>
                交班 {pendingSheet.fromOperator} → 接班 {pendingSheet.toOperator} · 移交{" "}
                {pendingSheet.items.length} 项进行中充填
              </p>
              {pendingSheet.items.length > 0 && (
                <table className="sheet-table">
                  <thead>
                    <tr>
                      <th>气瓶</th>
                      <th>设备</th>
                      <th>原操作员</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSheet.items.map((item) => (
                      <tr key={item.fillId}>
                        <td>{item.tankCode}</td>
                        <td>{item.equipmentName}</td>
                        <td>{item.fromOperator}</td>
                        <td>{STATUS_LABEL[item.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button
                className="primary"
                onClick={() => run((s) => confirmHandover(s, pendingSheet.id, pendingSheet.toOperator))}
              >
                我是 {pendingSheet.toOperator}，确认接班
              </button>
              <p className="hint-text">
                确认后「{shiftLabel(pendingSheet.fromShiftId)}」立即锁定，重复或并发确认只会成功一次。
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="group-title">
            历史交接单<em>{confirmedSheets.length}</em>
          </h3>
          {confirmedSheets.length === 0 && <p className="empty">暂无已确认交接单</p>}
          {confirmedSheets.map((h) => (
            <article key={h.id} className="history-row">
              <p>
                <strong>{shiftLabel(h.fromShiftId)}</strong> →{" "}
                <strong>{h.toShiftId ? shiftLabel(h.toShiftId) : "-"}</strong>
              </p>
              <p>
                {h.fromOperator} → {h.toOperator} · 确认于 {fmtTime(h.confirmedAt)} · 移交{" "}
                {h.items.length} 项
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="locked-section">
        <h3 className="group-title">
          已锁定班次快照<em>{lockedShifts.length}</em>
        </h3>
        {lockedShifts.length === 0 && <p className="empty">暂无已锁定班次</p>}
        {lockedShifts.map((s) => (
          <LockedShiftCard key={s.id} state={state} shift={s} />
        ))}
      </div>

      <div className="locked-section">
        <h3 className="group-title">漏记更正登记</h3>
        <CorrectionForm state={state} run={run} />
      </div>
    </section>
  );
}
