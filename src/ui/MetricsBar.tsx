import { AppState } from "../domain/types";

export function MetricsBar({ state }: { state: AppState }) {
  const fills = state.fills.filter((f) => f.shiftId === state.currentShiftId);
  const queued = fills.filter((f) => f.status === "queued").length;
  const filling = fills.filter((f) => f.status === "filling").length;
  const unsigned = fills.filter((f) => f.status === "completed").length;
  const reworkOpen = fills.filter((f) => f.rework?.open).length;
  const cleanPending = state.cleaningOrders.filter((o) => o.status === "pending").length;
  const lockedShifts = state.shifts.filter((s) => s.status === "locked").length;

  const cards = [
    { label: "待充填", value: queued, alert: false },
    { label: "充填中", value: filling, alert: false },
    { label: "待签收", value: unsigned, alert: unsigned > 0 },
    { label: "返工未关闭", value: reworkOpen, alert: reworkOpen > 0 },
    { label: "待处理清洗单", value: cleanPending, alert: cleanPending > 0 },
    { label: "已锁定班次", value: lockedShifts, alert: false },
  ];

  return (
    <section className="metrics">
      {cards.map((c) => (
        <article key={c.label} className={c.alert ? "alert" : ""}>
          <small>{c.label}</small>
          <strong>{c.value}</strong>
        </article>
      ))}
    </section>
  );
}
