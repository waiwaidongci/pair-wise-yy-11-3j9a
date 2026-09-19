// ============================================================
// 领域模型：潜水气瓶充填 + 班次交接闭环
// 本文件只包含类型定义，不含任何业务规则或存储逻辑。
// ============================================================

/** 充填记录生命周期：待充填 → 充填中 → 已完成(待签收) → 已签收 */
export type FillStatus = "queued" | "filling" | "completed" | "signed";

export type FillMethod = "空气" | "高氧" | "Trimix";

export interface Tank {
  id: string;
  code: string; // 气瓶编号，如 TANK-204
  volume: string; // 容积描述，如 "12L 铝瓶"
  inspectionDue: string; // 检验有效期，ISO 日期
}

export interface Equipment {
  id: string;
  name: string; // 空压机 / 混气面板 / 增压泵 …
}

/** 单瓶历史事件（时间线），交接转出/转入、更正批注都会写入 */
export interface FillEvent {
  at: string;
  type:
    | "created"
    | "started"
    | "completed"
    | "signed"
    | "rework_open"
    | "rework_close"
    | "handover_out"
    | "handover_in"
    | "correction";
  actor: string;
  note?: string;
}

export interface ReworkInfo {
  reason: string;
  open: boolean; // 返工未关闭时阻止交班与签收
  openedAt: string;
  closedAt?: string;
}

export interface FillRecord {
  id: string;
  tankId: string;
  shiftId: string; // 当前所属班次（交接后随班次转移）
  residualBar: number; // 残压
  targetBar: number; // 目标压力
  o2Percent: number; // 氧含量 %
  hePercent: number; // 氦含量 %
  method: FillMethod; // 充填方式
  operator: string; // 当前负责操作员（交接后变为接班人）
  equipmentId: string;
  status: FillStatus;
  rework: ReworkInfo | null;
  signedBy: string | null;
  signedAt: string | null;
  createdAt: string;
  events: FillEvent[];
}

export interface CleaningOrder {
  id: string;
  tankId: string;
  reason: string;
  status: "pending" | "done";
  shiftId: string;
  createdAt: string;
  doneAt?: string;
}

/** 旧班快照：锁定时生成，之后永不修改，不影响已发生的充填记录 */
export interface ShiftSnapshot {
  shiftId: string;
  label: string;
  operator: string;
  startedAt: string;
  lockedAt: string;
  signedCount: number;
  signedFills: { fillId: string; tankCode: string; summary: string }[];
}

export interface Shift {
  id: string;
  label: string;
  operator: string;
  startedAt: string;
  status: "open" | "locked";
  lockedAt?: string;
  snapshot?: ShiftSnapshot;
}

/** 交接单条目：进行中充填连同气瓶、设备、操作员一起移交 */
export interface HandoverItem {
  fillId: string;
  tankCode: string;
  equipmentName: string;
  fromOperator: string;
  status: FillStatus;
}

export interface HandoverSheet {
  id: string;
  fromShiftId: string;
  toShiftId: string | null; // 确认后指向新班次
  fromOperator: string;
  toOperator: string;
  createdAt: string;
  status: "pending" | "confirmed";
  confirmedAt: string | null;
  items: HandoverItem[];
}

/** 漏记更正：只能针对已锁定班次登记，记录在下一班（当前班）名下 */
export interface Correction {
  id: string;
  targetShiftId: string; // 被更正的已锁定班次
  targetFillId: string | null; // 关联充填记录（可选）
  note: string;
  registeredInShiftId: string; // 登记时所在的当前班次
  operator: string;
  createdAt: string;
}

export interface AppState {
  version: 1;
  tanks: Tank[];
  equipment: Equipment[];
  fills: FillRecord[];
  cleaningOrders: CleaningOrder[];
  shifts: Shift[];
  handovers: HandoverSheet[];
  corrections: Correction[];
  currentShiftId: string;
}
