import { useMemo, useState } from "react";
import { AppState, Equipment, FillRecord, Tank } from "../domain/types";
import {
  RuleResult,
  closeRework,
  completeFill,
  inspectionStatus,
  openRework,
  processCleaning,
  signFill,
  startFill,
} from "../domain/rules";
import { STATUS_LABEL, fmtTime, gasText } from "./format";

export interface PanelProps {
  state: AppState;
  run: (rule: (s: AppState) => RuleResult) => void;
}

function FillRow({
  fill,
  tank,
  equip,
  run,
}: {
  fill: FillRecord;
  tank: Tank | undefined;
  equip: Equipment | undefined;
  run: PanelProps["run"];
}) {
  const [signer, setSigner] = useState("");
  const [reason, setReason] = useState("");
  const expired = tank ? inspectionStatus(tank) === "expired" : false;

  return (
    <article className="fill-row">
      <div className="fill-main">
        <div className="fill-title">
          <h3>{tank?.code ?? fill.tankId}</h3>
          <span className={`badge ${fill.status}`}>{STATUS_LABEL[fill.status]}</span>
          {fill.rework?.open && <span className="badge rework">返工未关闭</span>}
          {expired && <span className="badge expired">检验已过期</span>}
        </div>
        <p>
          {tank?.volume} · 残压 {fill.residualBar}bar → 目标 {fill.targetBar}bar ·{" "}
          {gasText(fill.o2Percent, fill.hePercent)}（{fill.method}） · 设备 {equip?.name ?? "-"} ·
          操作员 {fill.operator} · 登记 {fmtTime(fill.createdAt)}
        </p>
        {fill.rework?.open && <p className="rework-note">返工原因：{fill.rework.reason}</p>}
        {fill.status === "signed" && (
          <p className="signed-note">
            签收人 {fill.signedBy} · {fmtTime(fill.signedAt)}
          </p>
        )}
      </div>

      <div className="fill-actions">
        {fill.status === "queued" && (
          <button
            className="primary"
            disabled={expired}
            title={expired ? "气瓶检验已过期，禁止充填" : ""}
            onClick={() => run((s) => startFill(s, fill.id, fill.operator))}
          >
            开始充填
          </button>
        )}

        {fill.status === "filling" && (
          <>
            <button className="primary" onClick={() => run((s) => completeFill(s, fill.id, fill.operator))}>
              完成充填
            </button>
            {!fill.rework?.open && (
              <span className="inline-form">
                <input
                  placeholder="返工原因"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button onClick={() => run((s) => openRework(s, fill.id, reason, fill.operator))}>
                  标记返工
                </button>
              </span>
            )}
          </>
        )}

        {fill.status === "completed" && (
          <>
            {fill.rework?.open ? (
              <button className="primary" onClick={() => run((s) => closeRework(s, fill.id, fill.operator))}>
                关闭返工
              </button>
            ) : (
              <>
                <span className="inline-form">
                  <input
                    placeholder="签收人"
                    value={signer}
                    onChange={(e) => setSigner(e.target.value)}
                  />
                  <button className="primary" onClick={() => run((s) => signFill(s, fill.id, signer))}>
                    签收
                  </button>
                </span>
                <span className="inline-form">
                  <input
                    placeholder="返工原因"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button onClick={() => run((s) => openRework(s, fill.id, reason, fill.operator))}>
                    标记返工
                  </button>
                </span>
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function FillWorkbench({ state, run }: PanelProps) {
  const tankById = useMemo(() => new Map(state.tanks.map((t) => [t.id, t])), [state.tanks]);
  const equipById = useMemo(
    () => new Map(state.equipment.map((e) => [e.id, e])),
    [state.equipment],
  );

  const fills = state.fills.filter((f) => f.shiftId === state.currentShiftId);
  const groups: { title: string; list: FillRecord[] }[] = [
    { title: "待充填队列", list: fills.filter((f) => f.status === "queued") },
    { title: "充填中", list: fills.filter((f) => f.status === "filling") },
    { title: "待签收", list: fills.filter((f) => f.status === "completed") },
    { title: "本班已签收", list: fills.filter((f) => f.status === "signed") },
  ];

  const cleanOrders = [...state.cleaningOrders].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "pending" ? -1 : 1,
  );

  return (
    <section className="panel workbench">
      <div className="heading">
        <div>
          <p>充填工作台</p>
          <h2>本班充填队列</h2>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.title} className="fill-group">
          <h3 className="group-title">
            {g.title}
            <em>{g.list.length}</em>
          </h3>
          {g.list.length === 0 && <p className="empty">暂无记录</p>}
          {g.list.map((f) => (
            <FillRow
              key={f.id}
              fill={f}
              tank={tankById.get(f.tankId)}
              equip={equipById.get(f.equipmentId)}
              run={run}
            />
          ))}
        </div>
      ))}

      <div className="fill-group">
        <h3 className="group-title">
          清洗单<em>{cleanOrders.filter((o) => o.status === "pending").length} 待处理</em>
        </h3>
        {cleanOrders.length === 0 && <p className="empty">暂无清洗单</p>}
        {cleanOrders.map((o) => (
          <article key={o.id} className="fill-row">
            <div className="fill-main">
              <div className="fill-title">
                <h3>{tankById.get(o.tankId)?.code ?? o.tankId}</h3>
                <span className={`badge ${o.status === "pending" ? "filling" : "signed"}`}>
                  {o.status === "pending" ? "待处理" : "已处理"}
                </span>
              </div>
              <p>
                {o.reason} · 开立 {fmtTime(o.createdAt)}
                {o.doneAt ? ` · 处理 ${fmtTime(o.doneAt)}` : ""}
              </p>
            </div>
            {o.status === "pending" && (
              <div className="fill-actions">
                <button className="primary" onClick={() => run((s) => processCleaning(s, o.id, ""))}>
                  处理完成
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
