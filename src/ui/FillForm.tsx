// ============================================================
// 界面：新增充填登记 —— 混合气比例提示、检验过期提醒
// ============================================================

import { useMemo, useState } from "react";
import { activeShift, mixHint } from "../domain/rules";
import type { NewFillInput } from "../domain/rules";
import type { AppState, FillMode } from "../domain/types";
import { today } from "./format";

interface Props {
  state: AppState;
  /** 返回 true 表示规则校验通过，可清空表单 */
  onSubmit: (input: NewFillInput) => boolean;
}

function deriveMode(o2: number, he: number): FillMode {
  if (he > 0) return "Trimix";
  if (o2 > 21) return "高氧";
  return "空气";
}

export function FillForm({ state, onSubmit }: Props) {
  const shift = activeShift(state);
  const [tankCode, setTankCode] = useState("");
  const [volume, setVolume] = useState("");
  const [inspectionDue, setInspectionDue] = useState("");
  const [residualBar, setResidualBar] = useState("50");
  const [targetBar, setTargetBar] = useState("200");
  const [o2, setO2] = useState("21");
  const [he, setHe] = useState("0");
  const [equipmentId, setEquipmentId] = useState("压缩机-A");
  const [operator, setOperator] = useState("");

  const o2Num = Number(o2) || 0;
  const heNum = Number(he) || 0;
  const hint = useMemo(() => mixHint(o2Num, heNum), [o2Num, heNum]);
  const overdue = inspectionDue !== "" && inspectionDue < today();

  const pickTank = (code: string) => {
    setTankCode(code);
    const tank = state.tanks.find((t) => t.code === code);
    if (tank) {
      setVolume(tank.volume);
      setInspectionDue(tank.inspectionDue);
    }
  };

  const submit = () => {
    const ok = onSubmit({
      tankCode,
      volume,
      inspectionDue,
      residualBar: Number(residualBar),
      targetBar: Number(targetBar),
      o2: o2Num,
      he: heNum,
      mode: deriveMode(o2Num, heNum),
      equipmentId,
      operator: operator.trim() || shift?.operator || "",
    });
    if (ok) {
      setTankCode("");
      setVolume("");
      setInspectionDue("");
      setResidualBar("50");
      setTargetBar("200");
      setO2("21");
      setHe("0");
    }
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>专业字段</p>
          <h2>新增充填登记</h2>
        </div>
        <button className="primary" onClick={submit} disabled={!shift}>
          {shift ? "保存并入队" : "交接中，暂不可登记"}
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>气瓶编号</span>
          <input
            list="tank-codes"
            value={tankCode}
            placeholder="如 TANK-204"
            onChange={(e) => pickTank(e.target.value)}
          />
          <datalist id="tank-codes">
            {state.tanks.map((t) => (
              <option key={t.id} value={t.code} />
            ))}
          </datalist>
        </label>
        <label>
          <span>容积</span>
          <input value={volume} placeholder="如 12L 铝瓶" onChange={(e) => setVolume(e.target.value)} />
        </label>
        <label>
          <span>检验有效期</span>
          <input
            type="date"
            value={inspectionDue}
            onChange={(e) => setInspectionDue(e.target.value)}
          />
        </label>
        <label>
          <span>残压（bar）</span>
          <input type="number" min={0} value={residualBar} onChange={(e) => setResidualBar(e.target.value)} />
        </label>
        <label>
          <span>目标压力（bar）</span>
          <input type="number" min={0} value={targetBar} onChange={(e) => setTargetBar(e.target.value)} />
        </label>
        <label>
          <span>氧含量（%）</span>
          <input type="number" min={0} max={100} value={o2} onChange={(e) => setO2(e.target.value)} />
        </label>
        <label>
          <span>氦含量（%）</span>
          <input type="number" min={0} max={100} value={he} onChange={(e) => setHe(e.target.value)} />
        </label>
        <label>
          <span>充填设备</span>
          <input value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} />
        </label>
        <label>
          <span>操作员（默认当班）</span>
          <input
            value={operator}
            placeholder={shift?.operator ?? "交接中"}
            onChange={(e) => setOperator(e.target.value)}
          />
        </label>
      </div>

      <div className="hints">
        <span className={`hint ${hint.warn ? "warn" : ""}`}>
          充填方式：{deriveMode(o2Num, heNum)} · {hint.text}
        </span>
        {overdue && <span className="hint warn">该气瓶检验已过期，充填前须重新检验</span>}
      </div>
    </section>
  );
}
