// ============================================================
// 业务规则层：纯函数，不触碰存储与界面。
// 每个规则接收当前 AppState，返回 Result；成功时携带新状态。
// ============================================================

import {
  AppState,
  Correction,
  FillMethod,
  FillRecord,
  HandoverSheet,
  Shift,
  Tank,
} from "./types";

export type RuleResult =
  | { ok: true; state: AppState; message: string }
  | { ok: false; error: string };

const ok = (state: AppState, message: string): RuleResult => ({ ok: true, state, message });
const fail = (error: string): RuleResult => ({ ok: false, error });

const now = () => new Date().toISOString();

let seq = 0;
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

// ------------------------------------------------------------
// 派生信息：混合气比例提示 / 检验状态 / 交班阻塞项
// ------------------------------------------------------------

export interface MixHint {
  method: FillMethod;
  label: string;
  modText: string | null; // 最大操作深度提示
  warnings: string[];
}

export function mixHint(o2Percent: number, hePercent: number): MixHint {
  const warnings: string[] = [];
  const method: FillMethod = hePercent > 0 ? "Trimix" : o2Percent > 21 ? "高氧" : "空气";
  const label =
    method === "Trimix"
      ? `Trimix ${o2Percent}/${hePercent}`
      : method === "高氧"
        ? `EAN${o2Percent}`
        : "压缩空气";

  let modText: string | null = null;
  if (o2Percent > 0 && o2Percent !== 21) {
    const mod = Math.max(0, Math.round(((1.4 / (o2Percent / 100)) - 1) * 10));
    modText = `PPO₂ 1.4 时最大操作深度约 ${mod} 米`;
  }
  if (o2Percent > 40) warnings.push("氧含量超过 40%：需使用氧清洁设备，系统将自动生成清洗单");
  if (hePercent > 0) warnings.push("含氦混合气：充填需双人复核并记录混气面板读数");
  if (o2Percent + hePercent > 100) warnings.push("氧含量 + 氦含量不能超过 100%");
  return { method, label, modText, warnings };
}

export type InspectionStatus = "expired" | "expiring" | "ok";

export function inspectionStatus(tank: Tank, today = new Date()): InspectionStatus {
  const due = new Date(tank.inspectionDue + "T00:00:00");
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "ok";
}

export function inspectionDaysLeft(tank: Tank, today = new Date()): number {
  const due = new Date(tank.inspectionDue + "T00:00:00");
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

export interface Blocker {
  type: "rework" | "unsigned" | "cleaning";
  message: string;
}

/** 交班阻塞项：返工未关闭 / 气瓶未签收 / 清洗单未处理 */
export function computeBlockers(state: AppState): Blocker[] {
  const blockers: Blocker[] = [];
  const tankCode = (id: string) => state.tanks.find((t) => t.id === id)?.code ?? id;

  for (const fill of state.fills) {
    if (fill.shiftId !== state.currentShiftId) continue;
    if (fill.rework?.open) {
      blockers.push({
        type: "rework",
        message: `返工未关闭：${tankCode(fill.tankId)}（${fill.rework.reason}）`,
      });
    }
    if (fill.status === "completed") {
      blockers.push({ type: "unsigned", message: `气瓶未签收：${tankCode(fill.tankId)}` });
    }
  }
  for (const order of state.cleaningOrders) {
    if (order.status === "pending") {
      blockers.push({
        type: "cleaning",
        message: `清洗单未处理：${tankCode(order.tankId)}（${order.reason}）`,
      });
    }
  }
  return blockers;
}

// ------------------------------------------------------------
// 内部工具
// ------------------------------------------------------------

function currentShift(state: AppState): Shift | undefined {
  return state.shifts.find((s) => s.id === state.currentShiftId);
}

function replaceFill(state: AppState, fill: FillRecord): AppState {
  return { ...state, fills: state.fills.map((f) => (f.id === fill.id ? fill : f)) };
}

function getFill(state: AppState, fillId: string): FillRecord | undefined {
  return state.fills.find((f) => f.id === fillId);
}

/** 已锁定班次的记录一律不可改，漏记只能走更正登记 */
function assertFillEditable(state: AppState, fill: FillRecord): string | null {
  const shift = state.shifts.find((s) => s.id === fill.shiftId);
  if (!shift) return "所属班次不存在";
  if (shift.status === "locked") {
    return `「${shift.label}」已锁定，漏记请在当前班次登记更正`;
  }
  return null;
}

// ------------------------------------------------------------
// 充填生命周期规则
// ------------------------------------------------------------

export interface NewFillInput {
  tankId: string;
  residualBar: number;
  targetBar: number;
  o2Percent: number;
  hePercent: number;
  operator: string;
  equipmentId: string;
}

export function addFill(state: AppState, input: NewFillInput): RuleResult {
  const shift = currentShift(state);
  if (!shift || shift.status !== "open") return fail("当前没有开放班次，无法登记充填");

  const tank = state.tanks.find((t) => t.id === input.tankId);
  if (!tank) return fail("气瓶不存在");
  if (inspectionStatus(tank) === "expired") {
    return fail(`气瓶 ${tank.code} 检验已过期，禁止充填`);
  }
  if (!state.equipment.some((e) => e.id === input.equipmentId)) return fail("充填设备不存在");
  if (!input.operator.trim()) return fail("请填写操作员");
  if (!(input.residualBar >= 0) || !(input.targetBar > 0)) return fail("残压/目标压力不合法");
  if (input.residualBar >= input.targetBar) return fail("残压必须小于目标压力");
  if (input.o2Percent < 21 || input.o2Percent > 100) return fail("氧含量需在 21–100% 之间");
  if (input.hePercent < 0 || input.hePercent > 79) return fail("氦含量需在 0–79% 之间");
  if (input.o2Percent + input.hePercent > 100) return fail("氧含量 + 氦含量不能超过 100%");

  const hint = mixHint(input.o2Percent, input.hePercent);
  const at = now();
  const fill: FillRecord = {
    id: uid("fill"),
    tankId: input.tankId,
    shiftId: shift.id,
    residualBar: input.residualBar,
    targetBar: input.targetBar,
    o2Percent: input.o2Percent,
    hePercent: input.hePercent,
    method: hint.method,
    operator: input.operator.trim(),
    equipmentId: input.equipmentId,
    status: "queued",
    rework: null,
    signedBy: null,
    signedAt: null,
    createdAt: at,
    events: [
      {
        at,
        type: "created",
        actor: input.operator.trim(),
        note: `登记充填 ${hint.label}，目标 ${input.targetBar}bar`,
      },
    ],
  };

  let next: AppState = { ...state, fills: [...state.fills, fill] };

  // 氧含量 > 40% 自动生成清洗单（氧清洁要求）
  if (input.o2Percent > 40) {
    next = {
      ...next,
      cleaningOrders: [
        ...next.cleaningOrders,
        {
          id: uid("clean"),
          tankId: input.tankId,
          reason: `高氧充填（O₂ ${input.o2Percent}%）后需氧清洗`,
          status: "pending",
          shiftId: shift.id,
          createdAt: at,
        },
      ],
    };
  }
  return ok(next, `已加入待充填队列：${tank.code}（${hint.label}）`);
}

export function startFill(state: AppState, fillId: string, actor: string): RuleResult {
  const fill = getFill(state, fillId);
  if (!fill) return fail("充填记录不存在");
  const locked = assertFillEditable(state, fill);
  if (locked) return fail(locked);
  if (fill.status !== "queued") return fail("仅待充填队列中的记录可以开始充填");
  const tank = state.tanks.find((t) => t.id === fill.tankId);
  if (tank && inspectionStatus(tank) === "expired") {
    return fail(`气瓶 ${tank.code} 检验已过期，禁止充填`);
  }
  return ok(
    replaceFill(state, {
      ...fill,
      status: "filling",
      events: [...fill.events, { at: now(), type: "started", actor, note: "开始充填" }],
    }),
    "已开始充填",
  );
}

export function completeFill(state: AppState, fillId: string, actor: string): RuleResult {
  const fill = getFill(state, fillId);
  if (!fill) return fail("充填记录不存在");
  const locked = assertFillEditable(state, fill);
  if (locked) return fail(locked);
  if (fill.status !== "filling") return fail("仅充填中的记录可以标记完成");
  return ok(
    replaceFill(state, {
      ...fill,
      status: "completed",
      events: [
        ...fill.events,
        { at: now(), type: "completed", actor, note: `充填完成，待签收（${fill.targetBar}bar）` },
      ],
    }),
    "充填完成，等待签收",
  );
}

export function signFill(state: AppState, fillId: string, signer: string): RuleResult {
  const fill = getFill(state, fillId);
  if (!fill) return fail("充填记录不存在");
  const locked = assertFillEditable(state, fill);
  if (locked) return fail(locked);
  if (fill.status !== "completed") return fail("仅已完成的充填可以签收");
  if (fill.rework?.open) return fail("返工未关闭，不能签收");
  if (!signer.trim()) return fail("请填写签收人");
  const at = now();
  return ok(
    replaceFill(state, {
      ...fill,
      status: "signed",
      signedBy: signer.trim(),
      signedAt: at,
      events: [...fill.events, { at, type: "signed", actor: signer.trim(), note: "签收完成" }],
    }),
    "签收完成",
  );
}

export function openRework(state: AppState, fillId: string, reason: string, actor: string): RuleResult {
  const fill = getFill(state, fillId);
  if (!fill) return fail("充填记录不存在");
  const locked = assertFillEditable(state, fill);
  if (locked) return fail(locked);
  if (fill.status !== "completed" && fill.status !== "filling") {
    return fail("仅充填中或已完成的记录可以标记返工");
  }
  if (fill.rework?.open) return fail("该记录已有未关闭的返工");
  if (!reason.trim()) return fail("请填写返工原因");
  const at = now();
  return ok(
    replaceFill(state, {
      ...fill,
      status: "filling", // 返工退回充填环节重做
      rework: { reason: reason.trim(), open: true, openedAt: at },
      events: [
        ...fill.events,
        { at, type: "rework_open", actor, note: `返工：${reason.trim()}` },
      ],
    }),
    "已标记返工，关闭前不得交班",
  );
}

export function closeRework(state: AppState, fillId: string, actor: string): RuleResult {
  const fill = getFill(state, fillId);
  if (!fill) return fail("充填记录不存在");
  const locked = assertFillEditable(state, fill);
  if (locked) return fail(locked);
  if (!fill.rework?.open) return fail("该记录没有未关闭的返工");
  if (fill.status !== "completed") return fail("请先重新完成充填，再关闭返工");
  const at = now();
  return ok(
    replaceFill(state, {
      ...fill,
      rework: { ...fill.rework, open: false, closedAt: at },
      events: [...fill.events, { at, type: "rework_close", actor, note: "返工关闭" }],
    }),
    "返工已关闭",
  );
}

export function processCleaning(state: AppState, orderId: string, actor: string): RuleResult {
  const order = state.cleaningOrders.find((o) => o.id === orderId);
  if (!order) return fail("清洗单不存在");
  if (order.status === "done") return fail("该清洗单已处理");
  const at = now();
  void actor;
  return ok(
    {
      ...state,
      cleaningOrders: state.cleaningOrders.map((o) =>
        o.id === orderId ? { ...o, status: "done" as const, doneAt: at } : o,
      ),
    },
    "清洗单已处理",
  );
}

// ------------------------------------------------------------
// 交接班规则
// ------------------------------------------------------------

/** 收班：生成交接单。有阻塞项或已存在待确认交接单时失败。 */
export function createHandover(state: AppState, toOperator: string): RuleResult {
  const shift = currentShift(state);
  if (!shift || shift.status !== "open") return fail("当前班次不可交班");
  if (!toOperator.trim()) return fail("请填写接班人");
  if (toOperator.trim() === shift.operator) return fail("接班人与当班操作员不能是同一人");

  const existing = state.handovers.find(
    (h) => h.fromShiftId === shift.id && h.status === "pending",
  );
  if (existing) return fail("本班次已存在待确认的交接单，请勿重复生成");

  const blockers = computeBlockers(state);
  if (blockers.length > 0) {
    return fail(`存在 ${blockers.length} 项未处理，不得交班：${blockers[0].message} 等`);
  }

  const tankCode = (id: string) => state.tanks.find((t) => t.id === id)?.code ?? id;
  const equipName = (id: string) => state.equipment.find((e) => e.id === id)?.name ?? id;

  // 进行中充填（待充填 + 充填中）连同气瓶、设备、操作员一起移交
  const items = state.fills
    .filter((f) => f.shiftId === shift.id && (f.status === "queued" || f.status === "filling"))
    .map((f) => ({
      fillId: f.id,
      tankCode: tankCode(f.tankId),
      equipmentName: equipName(f.equipmentId),
      fromOperator: f.operator,
      status: f.status,
    }));

  const sheet: HandoverSheet = {
    id: uid("handover"),
    fromShiftId: shift.id,
    toShiftId: null,
    fromOperator: shift.operator,
    toOperator: toOperator.trim(),
    createdAt: now(),
    status: "pending",
    confirmedAt: null,
    items,
  };
  return ok(
    { ...state, handovers: [...state.handovers, sheet] },
    `交接单已生成：${items.length} 项进行中充填待移交给 ${toOperator.trim()}`,
  );
}

/**
 * 接班确认（幂等）：同一班次重复或并发确认只成功一次。
 * 纯函数 + 存储层单事务提交：再次调用时交接单已非 pending，直接失败。
 */
export function confirmHandover(state: AppState, sheetId: string, confirmer: string): RuleResult {
  const sheet = state.handovers.find((h) => h.id === sheetId);
  if (!sheet) return fail("交接单不存在");
  if (sheet.status === "confirmed") return fail("该交接单已确认，重复/并发请求已忽略");

  const fromShift = state.shifts.find((s) => s.id === sheet.fromShiftId);
  if (!fromShift) return fail("原班次不存在");
  if (fromShift.status === "locked") return fail("该班次已锁定，交接早已完成");
  if (sheet.toOperator !== confirmer.trim()) {
    return fail(`交接单指定接班人为 ${sheet.toOperator}，请本人确认`);
  }

  // 确认时复检阻塞项：交接单生成后若又产生返工/未签收/未处理清洗单，仍不得交班
  const blockers = computeBlockers(state);
  if (blockers.length > 0) {
    return fail(`确认前发现 ${blockers.length} 项未处理：${blockers[0].message} 等`);
  }

  const at = now();
  const newShift: Shift = {
    id: uid("shift"),
    label: `${fromShift.label} 后·${sheet.toOperator}班`,
    operator: sheet.toOperator,
    startedAt: at,
    status: "open",
  };

  // 旧班快照：保留已签收充填的静态摘要，之后不再变化
  const tankCode = (id: string) => state.tanks.find((t) => t.id === id)?.code ?? id;
  const signedFills = state.fills
    .filter((f) => f.shiftId === fromShift.id && f.status === "signed")
    .map((f) => ({
      fillId: f.id,
      tankCode: tankCode(f.tankId),
      summary: `${f.method} O₂${f.o2Percent}%${f.hePercent > 0 ? ` He${f.hePercent}%` : ""} → ${f.targetBar}bar，签收人 ${f.signedBy ?? "-"}`,
    }));

  const lockedShift: Shift = {
    ...fromShift,
    status: "locked",
    lockedAt: at,
    snapshot: {
      shiftId: fromShift.id,
      label: fromShift.label,
      operator: fromShift.operator,
      startedAt: fromShift.startedAt,
      lockedAt: at,
      signedCount: signedFills.length,
      signedFills,
    },
  };

  // 进行中充填随交接转移到新班次，负责人变更为接班人，历史留痕。
  // 交接单生成后已签收的记录留在旧班（进入快照），不再转移。
  const transferredIds = new Set(sheet.items.map((i) => i.fillId));
  const fills = state.fills.map((f) => {
    if (!transferredIds.has(f.id)) return f;
    if (f.status !== "queued" && f.status !== "filling") return f;
    return {
      ...f,
      shiftId: newShift.id,
      operator: sheet.toOperator,
      events: [
        ...f.events,
        {
          at,
          type: "handover_out" as const,
          actor: sheet.fromOperator,
          note: `随「${fromShift.label}」交接转出`,
        },
        {
          at,
          type: "handover_in" as const,
          actor: sheet.toOperator,
          note: `接班人确认接收，转入「${newShift.label}」`,
        },
      ],
    };
  });

  const next: AppState = {
    ...state,
    fills,
    shifts: [...state.shifts.map((s) => (s.id === fromShift.id ? lockedShift : s)), newShift],
    handovers: state.handovers.map((h) =>
      h.id === sheet.id
        ? { ...h, status: "confirmed" as const, confirmedAt: at, toShiftId: newShift.id }
        : h,
    ),
    currentShiftId: newShift.id,
  };
  return ok(
    next,
    `接班确认成功：「${fromShift.label}」已锁定，${sheet.items.length} 项进行中充填已移交 ${sheet.toOperator}`,
  );
}

/** 漏记更正：只能针对已锁定班次，登记在当前（下一）班次名下 */
export function registerCorrection(
  state: AppState,
  input: { targetShiftId: string; targetFillId: string | null; note: string; operator: string },
): RuleResult {
  const target = state.shifts.find((s) => s.id === input.targetShiftId);
  if (!target) return fail("目标班次不存在");
  if (target.status !== "locked") return fail("只能对已锁定的班次登记更正");
  if (!input.note.trim()) return fail("请填写更正内容");
  if (!input.operator.trim()) return fail("请填写登记人");

  const shift = currentShift(state);
  if (!shift || shift.status !== "open") return fail("当前没有开放班次，无法登记更正");

  let targetFill: FillRecord | null = null;
  if (input.targetFillId) {
    targetFill = state.fills.find((f) => f.id === input.targetFillId) ?? null;
    if (!targetFill || targetFill.shiftId !== target.id) {
      return fail("关联的充填记录不属于该班次");
    }
  }

  const at = now();
  const correction: Correction = {
    id: uid("corr"),
    targetShiftId: target.id,
    targetFillId: targetFill?.id ?? null,
    note: input.note.trim(),
    registeredInShiftId: shift.id,
    operator: input.operator.trim(),
    createdAt: at,
  };

  // 更正只追加批注事件，不改动已发生充填的任何数据，旧班快照保持不变
  const fills = targetFill
    ? state.fills.map((f) =>
        f.id === targetFill!.id
          ? {
              ...f,
              events: [
                ...f.events,
                {
                  at,
                  type: "correction" as const,
                  actor: input.operator.trim(),
                  note: `下班更正：${input.note.trim()}`,
                },
              ],
            }
          : f,
      )
    : state.fills;

  return ok(
    { ...state, fills, corrections: [...state.corrections, correction] },
    `更正已登记在「${shift.label}」名下，原班记录保持不变`,
  );
}
