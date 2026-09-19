// ============================================================
// 领域模型：潜水气瓶充填 + 班次交接闭环
// 本层只定义类型，不含任何界面或存储逻辑。
// ============================================================

/** 充填方式 */
export type FillMode = "空气" | "高氧" | "Trimix";

/**
 * 充填单状态机：
 * queued  待充填（在队列中）
 * filling 充填中
 * filled  充填完成，待签收
 * signed  已签收（终态）
 * rework  返工中（须关联未关闭返工单）
 */
export type FillStatus = "queued" | "filling" | "filled" | "signed" | "rework";

/** 班次状态机：active 当班 → handing_over 待接班确认 → locked 已锁定（快照） */
export type ShiftStatus = "active" | "handing_over" | "locked";

export interface Tank {
  id: string;
  /** 气瓶编号，如 TANK-204 */
  code: string;
  /** 容积描述，如 12L 铝瓶 */
  volume: string;
  /** 检验有效期（YYYY-MM-DD） */
  inspectionDue: string;
}

export interface FillRecord {
  id: string;
  tankId: string;
  /** 归属班次；交接时进行中的单子会被转移到新班次 */
  shiftId: string;
  /** 残压 bar */
  residualBar: number;
  /** 目标压力 bar */
  targetBar: number;
  /** 氧含量 % */
  o2: number;
  /** 氦含量 % */
  he: number;
  mode: FillMode;
  /** 充填设备编号 */
  equipmentId: string;
  /** 当前负责操作员 */
  operator: string;
  status: FillStatus;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
}

export interface ReworkTicket {
  id: string;
  fillId: string;
  reason: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string;
}

export interface CleaningOrder {
  id: string;
  tankId: string;
  note: string;
  status: "pending" | "done";
  createdAt: string;
  doneAt?: string;
}

/** 交接单条目：进行中的充填连同气瓶、设备、操作员一起移交 */
export interface HandoverItem {
  fillId: string;
  tankId: string;
  tankCode: string;
  equipmentId: string;
  /** 交班时的原操作员（留痕） */
  fromOperator: string;
}

export interface HandoverSlip {
  id: string;
  fromShiftId: string;
  fromOperator: string;
  toOperator: string;
  items: HandoverItem[];
  createdAt: string;
  status: "pending" | "confirmed";
  confirmedAt?: string;
  /** 幂等令牌：确认时必须携带，重复/并发确认只会成功一次 */
  confirmToken: string;
}

export interface Shift {
  id: string;
  label: string;
  operator: string;
  status: ShiftStatus;
  startedAt: string;
  lockedAt?: string;
  /** 交班后留存的交接单快照 */
  handover?: HandoverSlip;
}

/** 更正单：班次锁定后，漏记/错记只能以更正形式补登，不改快照 */
export interface Correction {
  id: string;
  /** 被更正的已锁定班次 */
  shiftId: string;
  fillId: string;
  detail: string;
  author: string;
  createdAt: string;
}

export interface AppState {
  tanks: Tank[];
  fills: FillRecord[];
  reworks: ReworkTicket[];
  cleanings: CleaningOrder[];
  /** 全部班次；已锁定班次即历史快照，永久保留 */
  shifts: Shift[];
  corrections: Correction[];
  /** 单调递增序号，用于生成可读的业务单号 */
  seq: number;
}
