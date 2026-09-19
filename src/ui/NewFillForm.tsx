import { useState } from "react";
import {
  addFill,
  inspectionDaysLeft,
  inspectionStatus,
  mixHint,
} from "../domain/rules";
import { PanelProps } from "./FillWorkbench";

export function NewFillForm({ state, run }: PanelProps) {
  const shift = state.shifts.find((s) => s.id === state.currentShiftId);
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const [residual, setResidual] = useState("50");
  const [target, setTarget] = useState("200");
  const [o2, setO2] = useState("21");
  const [he, setHe] = useState("0");
  const [equipmentId, setEquipmentId] = useState(state.equipment[0]?.id ?? "");
  const [operator, setOperator] = useState(shift?.operator ?? "");

  const o2n = Number(o2);
  const hen = Number(he);
  const hint = mixHint(Number.isFinite(o2n) ? o2n : 21, Number.isFinite(hen) ? hen : 0);

  const tank = state.tanks.find((t) => t.id === tankId);
  const insp = tank ? inspectionStatus(tank) : null;
  const daysLeft = tank ? inspectionDaysLeft(tank) : 0;

  const submit = () => {
    run((s) =>
      addFill(s, {
        tankId,
        residualBar: Number(residual),
        targetBar: Number(target),
        o2Percent: o2n,
        hePercent: hen,
        operator,
        equipmentId,
      }),
    );
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>专业字段</p>
          <h2>新增充填记录</h2>
        </div>
        <button className="primary" onClick={submit}>
          保存记录
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>气瓶编号</span>
          <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
            {state.tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}（{t.volume}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>检验有效期</span>
          <div className="static-field">
            {tank?.inspectionDue ?? "-"}
            {insp === "expired" && <span className="badge expired">已过期，禁止充填</span>}
            {insp === "expiring" && <span className="badge filling">剩余 {daysLeft} 天</span>}
            {insp === "ok" && <span className="badge signed">有效</span>}
          </div>
        </label>
        <label>
          <span>残压（bar）</span>
          <input type="number" min="0" value={residual} onChange={(e) => setResidual(e.target.value)} />
        </label>
        <label>
          <span>目标压力（bar）</span>
          <input type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label>
          <span>氧含量 O₂（%）</span>
          <input type="number" min="21" max="100" value={o2} onChange={(e) => setO2(e.target.value)} />
        </label>
        <label>
          <span>氦含量 He（%）</span>
          <input type="number" min="0" max="79" value={he} onChange={(e) => setHe(e.target.value)} />
        </label>
        <label>
          <span>充填设备</span>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            {state.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>操作员</span>
          <input value={operator} onChange={(e) => setOperator(e.target.value)} />
        </label>
      </div>

      <div className="mix-hint">
        <div className="mix-line">
          <span className="badge queued">{hint.method}</span>
          <strong>{hint.label}</strong>
          {hint.modText && <em>{hint.modText}</em>}
        </div>
        {hint.warnings.map((w) => (
          <p key={w} className="warning">
            {w}
          </p>
        ))}
      </div>
    </section>
  );
}

export function InspectionReminders({ state }: { state: PanelProps["state"] }) {
  const flagged = state.tanks
    .map((t) => ({ tank: t, status: inspectionStatus(t), days: inspectionDaysLeft(t) }))
    .filter((x) => x.status !== "ok")
    .sort((a, b) => a.days - b.days);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>检验提醒</p>
          <h2>气瓶检验有效期</h2>
        </div>
      </div>
      {flagged.length === 0 && <p className="empty">全部气瓶检验均在有效期内</p>}
      <div className="records">
        {flagged.map(({ tank, status, days }) => (
          <article key={tank.id}>
            <b>{tank.code.slice(-3)}</b>
            <div>
              <h3>
                {tank.code}（{tank.volume}）
              </h3>
              <p>
                检验有效期至 {tank.inspectionDue} ·{" "}
                {status === "expired" ? `已过期 ${-days} 天，禁止充填` : `剩余 ${days} 天，请安排送检`}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
