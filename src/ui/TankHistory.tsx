// ============================================================
// 界面：单个气瓶历史记录（跨班次，含更正留痕）
// ============================================================

import { useState } from "react";
import { isInspectionOverdue } from "../domain/rules";
import type { AppState } from "../domain/types";
import { fmtTime, FILL_STATUS_TEXT, mixLabel, today } from "./format";

export function TankHistory({ state }: { state: AppState }) {
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const tank = state.tanks.find((t) => t.id === tankId);
  const fills = state.fills
    .filter((f) => f.tankId === tankId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>单瓶档案</p>
          <h2>气瓶历史记录</h2>
        </div>
        <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
          {state.tanks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} · {t.volume}
            </option>
          ))}
        </select>
      </div>

      {tank && (
        <p className="muted">
          {tank.code} · {tank.volume} · 检验有效期 {tank.inspectionDue || "未登记"}
          {isInspectionOverdue(tank, today()) && <span className="badge warn">检验过期</span>}
        </p>
      )}

      {fills.length === 0 && <p className="muted">该气瓶暂无充填记录。</p>}

      <div className="records">
        {fills.map((f) => {
          const shift = state.shifts.find((s) => s.id === f.shiftId);
          const corrections = state.corrections.filter((c) => c.fillId === f.id);
          return (
            <article key={f.id}>
              <b>{f.id.slice(-4)}</b>
              <div>
                <h3>
                  {mixLabel(f.o2, f.he)} · {f.residualBar}→{f.targetBar}bar
                  <span className={`badge st-${f.status}`}>{FILL_STATUS_TEXT[f.status]}</span>
                </h3>
                <p>
                  {shift ? `${shift.id} ${shift.label}（${shift.operator}）` : f.shiftId} · 经手{" "}
                  {f.operator} · {f.equipmentId} · 登记 {fmtTime(f.createdAt)}
                  {f.signedAt && ` · 签收 ${fmtTime(f.signedAt)}`}
                </p>
                {corrections.map((c) => (
                  <p key={c.id} className="correction-line">
                    更正 {c.id}：{c.detail}（{c.author}，{fmtTime(c.createdAt)}）
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
