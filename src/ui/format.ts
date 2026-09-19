// ============================================================
// 界面辅助：文案与格式化（纯展示，不含业务规则）
// ============================================================

import type { FillStatus, ShiftStatus } from "../domain/types";

export const FILL_STATUS_TEXT: Record<FillStatus, string> = {
  queued: "待充填",
  filling: "充填中",
  filled: "待签收",
  signed: "已签收",
  rework: "返工中",
};

export const SHIFT_STATUS_TEXT: Record<ShiftStatus, string> = {
  active: "当班中",
  handing_over: "待接班确认",
  locked: "已锁定",
};

export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function mixLabel(o2: number, he: number): string {
  if (he > 0) return `Trimix ${o2}/${he}`;
  if (o2 > 21) return `EAN${o2}`;
  return "空气";
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}
