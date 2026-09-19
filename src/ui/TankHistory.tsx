import { useState } from "react";
import { FillEvent } from "../domain/types";
import { inspectionDaysLeft, inspectionStatus } from "../domain/rules";
import { STATUS_LABEL, fmtTime, gasText } from "./format";
import { PanelProps } from "./FillWorkbench";

const EVENT_LABEL: Record<FillEvent["type"], string> = {
  created: "登记",
  started: "开始充填",
  completed: "充填完成",
  signed: "签收",
  rework_open: "标记返工",
  rework_close: "返工关闭",
  handover_out: "交接转出",
  handover_in: "交接转入",
  correction: "更正批注",
};

export function TankHistory({ state }: PanelProps) {
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const tank = state.tanks.find((t) => t.id === tankId);
  const shiftById = new Map(state.shifts.map((s) => [s.id, s]));

  const fills = state.fills
    .filter((f) => f.tankId === tankId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const insp = tank ? inspectionStatus(tank) : null;
  const days = tank ? inspectionDaysLeft(tank) : 0;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>单瓶历史</p>
          <h2>气瓶充填档案</h2>
        </div>
        <label className="tank-picker">
          <span>气瓶编号</span>
          <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
            {state.tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tank && (
        <p className="tank-summary">
          {tank.code} · {tank.volume} · 检验有效期至 {tank.inspectionDue}
          {insp === "expired" && <span className="badge expired">已过期 {-days} 天</span>}
          {insp === "expiring" && <span className="badge filling">剩余 {days} 天</span>}
          {insp === "ok" && <span className="badge signed">有效</span>}
        </p>
      )}

      {fills.length === 0 && <p className="empty">该气瓶暂无充填记录</p>}

      {fills.map((f) => {
        const shift = shiftById.get(f.shiftId);
        return (
          <article key={f.id} className="history-fill">
            <div className="fill-title">
              <h3>
                {shift?.label ?? f.shiftId}
                {shift?.status === "locked" && <span className="badge locked">已锁定</span>}
              </h3>
              <span className={`badge ${f.status}`}>{STATUS_LABEL[f.status]}</span>
            </div>
            <p>
              {gasText(f.o2Percent, f.hePercent)}（{f.method}） · 残压 {f.residualBar}bar → 目标{" "}
              {f.targetBar}bar · 操作员 {f.operator}
              {f.signedBy ? ` · 签收人 ${f.signedBy}` : ""}
            </p>
            <ul className="timeline">
              {f.events.map((e, i) => (
                <li key={i}>
                  <span className="timeline-dot" />
                  <span className="timeline-type">{EVENT_LABEL[e.type]}</span>
                  <span className="timeline-meta">
                    {fmtTime(e.at)} · {e.actor}
                  </span>
                  {e.note && <span className="timeline-note">{e.note}</span>}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
