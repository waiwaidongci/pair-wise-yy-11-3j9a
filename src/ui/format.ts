import { FillStatus } from "../domain/types";

export const STATUS_LABEL: Record<FillStatus, string> = {
  queued: "待充填",
  filling: "充填中",
  completed: "待签收",
  signed: "已签收",
};

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(isoDate: string): string {
  return isoDate;
}

export function gasText(o2: number, he: number): string {
  if (he > 0) return `O₂${o2}% / He${he}%`;
  if (o2 > 21) return `O₂${o2}%`;
  return "空气";
}
