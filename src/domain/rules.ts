// ============================================================
// 业务规则层：纯函数实现，不依赖界面与存储。
// 覆盖：充填流转、返工/清洗、交班校验、交接单生成、
//       幂等接班确认、班次锁定、锁定后更正。
// ============================================================

import type {
  AppState,
  CleaningOrder,
  Correction,
  FillMode,
  FillRecord,
  HandoverItem,
  HandoverSlip,
  ReworkTicket,
  Shift,
  Tank,
} from "./types";

export type RuleOk = { ok: true; state: AppState };
export type RuleFail = { ok: false; errors: string[] };
export type RuleResult = RuleOk | RuleFail;

export interface ConfirmResult {
  ok: boolean;
  /** true 表示该交接单此前已确认，本次为重复/并发调用 */
  already: boolean;
  errors: string[];
  state: AppState;
}

// ---------- 工具 ----------

function nextId(state: AppState, prefix: string): { id: string; seq: number } {
  const seq = state.seq + 1;
  return { id: `${prefix}-${String(seq).padStart(4, "0")}`, seq };
}

export function activeShift(state: AppState): Shift | undefined {
  return state.shifts.find((s) => s.status === "active");
}

export function tankOf(state: AppState, tankId: string): Tank | undefined {
  return state.tanks.find((t) => t.id === tankId);
}

export function fillOf(state: AppState, fillId: string): FillRecord | undefined {
  return state.fills.find((f) => f.id === fillId);
}

function patchFill(state: AppState, fillId: string, patch: Partial<FillRecord>): AppState {
  return {
    ...state,
    fills: state.fills.map((f) => (f.id === fillId ? { ...f, ...patch } : f)),
  };
}

function patchShift(state: AppState, shiftId: string, patch: Partial<Shift>): AppState {
  return {
    ...state,
    shifts: state.shifts.map((s) => (s.id === shiftId ? { ...s, ...patch } : s)),
  };
}

// ---------- 气瓶 / 充填登记 ----------

export interface NewFillInput {
  tankCode: string;
  volume: string;
  inspectionDue: string;
  residualBar: number;
  targetBar: number;
  o2: number;
  he: number;
  mode: FillMode;
  equipmentId: string;
  operator: string;
}

/** 登记充填：气瓶按编号 upsert，充填单进入当班队列 */
export function registerFill(state: AppState, input: NewFillInput, now: string): RuleResult {
  const errors: string[] = [];
  const shift = activeShift(state);
  if (!shift) errors.push("当前没有进行中的班次，无法登记充填");
  if (!input.tankCode.trim()) errors.push("气瓶编号不能为空");
  if (!input.operator.trim()) errors.push("操作员不能为空");
  if (!input.equipmentId.trim()) errors.push("充填设备不能为空");
  if (!(input.residualBar >= 0)) errors.push("残压不能为负");
  if (!(input.targetBar > input.residualBar)) errors.push("目标压力必须大于残压");
  if (input.o2 < 0 || input.he < 0 || input.o2 + input.he > 100)
    errors.push("氧/氦含量不合法（合计不能超过 100%）");
  if (errors.length) return { ok: false, errors };

  const code = input.tankCode.trim();
  let { tanks } = state;
  let tank = tanks.find((t) => t.code === code);
  let seq = state.seq;
  if (!tank) {
    const nid = nextId({ ...state, seq }, "TK");
    seq = nid.seq;
    tank = {
      id: nid.id,
      code,
      volume: input.volume.trim() || "未标注",
      inspectionDue: input.inspectionDue || "",
    };
    tanks = [...tanks, tank];
  } else {
    // 已存在的气瓶同步最新容积与检验期
    tanks = tanks.map((t) =>
      t.id === tank!.id
        ? { ...t, volume: input.volume.trim() || t.volume, inspectionDue: input.inspectionDue || t.inspectionDue }
        : t
    );
  }

  const nid = nextId({ ...state, seq }, "FL");
  const fill: FillRecord = {
    id: nid.id,
    tankId: tank.id,
    shiftId: shift!.id,
    residualBar: input.residualBar,
    targetBar: input.targetBar,
    o2: input.o2,
    he: input.he,
    mode: input.mode,
    equipmentId: input.equipmentId.trim(),
    operator: input.operator.trim(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, state: { ...state, tanks, fills: [...state.fills, fill], seq: nid.seq } };
}

// ---------- 充填状态流转 ----------

export function startFill(state: AppState, fillId: string, now: string): RuleResult {
  const fill = fillOf(state, fillId);
  if (!fill) return { ok: false, errors: ["充填单不存在"] };
  if (fill.status !== "queued") return { ok: false, errors: [`${fillId} 当前状态不允许开始充填`] };
  return { ok: true, state: patchFill(state, fillId, { status: "filling", updatedAt: now }) };
}

export function completeFill(state: AppState, fillId: string, now: string): RuleResult {
  const fill = fillOf(state, fillId);
  if (!fill) return { ok: false, errors: ["充填单不存在"] };
  if (fill.status !== "filling") return { ok: false, errors: [`${fillId} 不在充填中，无法完成`] };
  return { ok: true, state: patchFill(state, fillId, { status: "filled", updatedAt: now }) };
}

export function signFill(state: AppState, fillId: string, now: string): RuleResult {
  const fill = fillOf(state, fillId);
  if (!fill) return { ok: false, errors: ["充填单不存在"] };
  if (fill.status !== "filled") return { ok: false, errors: [`${fillId} 不在待签收状态`] };
  const shift = state.shifts.find((s) => s.id === fill.shiftId);
  if (shift?.status === "locked") return { ok: false, errors: ["该班次已锁定，不能补签收"] };
  return {
    ok: true,
    state: patchFill(state, fillId, { status: "signed", signedAt: now, updatedAt: now }),
  };
}

// ---------- 返工 ----------

export function openRework(state: AppState, fillId: string, reason: string, now: string): RuleResult {
  const fill = fillOf(state, fillId);
  if (!fill) return { ok: false, errors: ["充填单不存在"] };
  if (fill.status !== "filled" && fill.status !== "signed")
    return { ok: false, errors: ["只有已充填的单子才能发起返工"] };
  if (!reason.trim()) return { ok: false, errors: ["返工原因不能为空"] };
  const nid = nextId(state, "RW");
  const ticket: ReworkTicket = {
    id: nid.id,
    fillId,
    reason: reason.trim(),
    status: "open",
    openedAt: now,
  };
  const next = patchFill(
    { ...state, reworks: [...state.reworks, ticket], seq: nid.seq },
    fillId,
    { status: "rework", updatedAt: now }
  );
  return { ok: true, state: next };
}

export function closeRework(state: AppState, ticketId: string, now: string): RuleResult {
  const ticket = state.reworks.find((r) => r.id === ticketId);
  if (!ticket) return { ok: false, errors: ["返工单不存在"] };
  if (ticket.status === "closed") return { ok: false, errors: ["返工单已关闭"] };
  const next: AppState = {
    ...state,
    reworks: state.reworks.map((r) =>
      r.id === ticketId ? { ...r, status: "closed", closedAt: now } : r
    ),
  };
  // 返工关闭后气瓶重新排队充填
  return { ok: true, state: patchFill(next, ticket.fillId, { status: "queued", updatedAt: now }) };
}

// ---------- 清洗单 ----------

export function createCleaning(state: AppState, tankId: string, note: string, now: string): RuleResult {
  if (!tankOf(state, tankId)) return { ok: false, errors: ["气瓶不存在"] };
  const nid = nextId(state, "CL");
  const order: CleaningOrder = {
    id: nid.id,
    tankId,
    note: note.trim() || "常规清洗",
    status: "pending",
    createdAt: now,
  };
  return { ok: true, state: { ...state, cleanings: [...state.cleanings, order], seq: nid.seq } };
}

export function doneCleaning(state: AppState, orderId: string, now: string): RuleResult {
  const order = state.cleanings.find((c) => c.id === orderId);
  if (!order) return { ok: false, errors: ["清洗单不存在"] };
  if (order.status === "done") return { ok: false, errors: ["清洗单已处理"] };
  return {
    ok: true,
    state: {
      ...state,
      cleanings: state.cleanings.map((c) =>
        c.id === orderId ? { ...c, status: "done", doneAt: now } : c
      ),
    },
  };
}

// ---------- 交班 ----------

/**
 * 交班前置校验：返工未关闭 / 气瓶未签收 / 清洗单未处理 时不得交班。
 * 返回人类可读的阻塞原因列表，空数组表示可以交班。
 */
export function handoverBlockers(state: AppState): string[] {
  const blockers: string[] = [];
  for (const r of state.reworks.filter((r) => r.status === "open")) {
    const fill = fillOf(state, r.fillId);
    const tank = fill ? tankOf(state, fill.tankId) : undefined;
    blockers.push(`返工单 ${r.id} 未关闭（${tank?.code ?? r.fillId}）`);
  }
  for (const f of state.fills.filter((f) => f.status === "filled")) {
    const tank = tankOf(state, f.tankId);
    blockers.push(`气瓶 ${tank?.code ?? f.tankId} 充填完成未签收（${f.id}）`);
  }
  for (const c of state.cleanings.filter((c) => c.status === "pending")) {
    const tank = tankOf(state, c.tankId);
    blockers.push(`清洗单 ${c.id} 未处理（${tank?.code ?? c.tankId}）`);
  }
  return blockers;
}

/**
 * 发起交班：校验通过后生成交接单，进行中的充填（待充填/充填中）
 * 连同气瓶、设备、操作员一并列入移交清单；班次进入待确认状态。
 * 重复发起返回已有交接单，不重复生成。
 */
export function requestHandover(
  state: AppState,
  toOperator: string,
  now: string
): RuleResult & { slip?: HandoverSlip } {
  const shift = activeShift(state);
  if (!shift) {
    // 已在交接流程中：幂等返回现有交接单
    const handing = state.shifts.find((s) => s.status === "handing_over" && s.handover);
    if (handing?.handover) return { ok: true, state, slip: handing.handover };
    return { ok: false, errors: ["当前没有可交班的班次"] };
  }
  if (!toOperator.trim()) return { ok: false, errors: ["接班人不能为空"] };
  if (toOperator.trim() === shift.operator)
    return { ok: false, errors: ["接班人与当班操作员相同，无需交班"] };

  const blockers = handoverBlockers(state);
  if (blockers.length) return { ok: false, errors: ["存在未了事项，不得交班：", ...blockers] };

  const inProgress = state.fills.filter(
    (f) => f.shiftId === shift.id && (f.status === "queued" || f.status === "filling")
  );
  const items: HandoverItem[] = inProgress.map((f) => {
    const tank = tankOf(state, f.tankId);
    return {
      fillId: f.id,
      tankId: f.tankId,
      tankCode: tank?.code ?? f.tankId,
      equipmentId: f.equipmentId,
      fromOperator: f.operator,
    };
  });

  const nid = nextId(state, "HO");
  const slip: HandoverSlip = {
    id: nid.id,
    fromShiftId: shift.id,
    fromOperator: shift.operator,
    toOperator: toOperator.trim(),
    items,
    createdAt: now,
    status: "pending",
    confirmToken: `${nid.id}-${state.seq + 1}-token`,
  };
  const next = patchShift({ ...state, seq: nid.seq }, shift.id, {
    status: "handing_over",
    handover: slip,
  });
  return { ok: true, state: next, slip };
}

/**
 * 接班确认（幂等）：
 * - 必须携带交接单的 confirmToken；
 * - 同一交接单重复或并发确认只成功一次，之后调用返回 already=true；
 * - 成功后旧班次锁定为快照，开启新班次，进行中充填连同设备转移给接班人；
 * - 已签收/已完成的充填保持原班次归属，历史不受影响。
 */
export function confirmHandover(
  state: AppState,
  shiftId: string,
  token: string,
  now: string
): ConfirmResult {
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift || !shift.handover)
    return { ok: false, already: false, errors: ["交接单不存在"], state };
  const slip = shift.handover;

  if (slip.status === "confirmed" || shift.status === "locked") {
    // 幂等：重复/并发确认不再产生副作用
    return { ok: false, already: true, errors: [`交接单 ${slip.id} 已确认，请勿重复操作`], state };
  }
  if (shift.status !== "handing_over")
    return { ok: false, already: false, errors: ["该班次不在待交接状态"], state };
  if (token !== slip.confirmToken)
    return { ok: false, already: false, errors: ["确认令牌不匹配，操作被拒绝"], state };

  const confirmedSlip: HandoverSlip = { ...slip, status: "confirmed", confirmedAt: now };
  const nid = nextId(state, "SH");
  const newShift: Shift = {
    id: nid.id,
    label: `${shift.label} → 接班`,
    operator: slip.toOperator,
    status: "active",
    startedAt: now,
  };

  // 转移进行中的充填：班次、操作员改为接班人，设备随单走
  const transferred = new Set(slip.items.map((i) => i.fillId));
  const fills = state.fills.map((f) =>
    transferred.has(f.id)
      ? { ...f, shiftId: newShift.id, operator: slip.toOperator, updatedAt: now }
      : f
  );

  const next: AppState = {
    ...state,
    fills,
    seq: nid.seq,
    shifts: state.shifts
      .map((s): Shift =>
        s.id === shift.id
          ? { ...s, status: "locked", lockedAt: now, handover: confirmedSlip }
          : s
      )
      .concat(newShift),
  };
  return { ok: true, already: false, errors: [], state: next };
}

// ---------- 锁定后更正 ----------

/**
 * 班次锁定后，漏记/错记只能登记更正单：
 * 更正挂在被锁定班次与具体充填单上，不修改历史快照本身。
 */
export function addCorrection(
  state: AppState,
  shiftId: string,
  fillId: string,
  detail: string,
  author: string,
  now: string
): RuleResult {
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift) return { ok: false, errors: ["班次不存在"] };
  if (shift.status !== "locked") return { ok: false, errors: ["只有已锁定的班次才需要登记更正"] };
  const fill = fillOf(state, fillId);
  if (!fill || fill.shiftId !== shiftId)
    return { ok: false, errors: [`充填单不属于班次 ${shift.label}，无法对其更正`] };
  if (!detail.trim()) return { ok: false, errors: ["更正内容不能为空"] };
  if (!author.trim()) return { ok: false, errors: ["更正人不能为空"] };

  const nid = nextId(state, "CR");
  const correction: Correction = {
    id: nid.id,
    shiftId,
    fillId,
    detail: detail.trim(),
    author: author.trim(),
    createdAt: now,
  };
  return {
    ok: true,
    state: { ...state, corrections: [...state.corrections, correction], seq: nid.seq },
  };
}

// ---------- 提示类派生规则（只读） ----------

/** 混合气比例提示 */
export function mixHint(o2: number, he: number): { text: string; warn: boolean } {
  if (o2 + he > 100 || o2 < 0 || he < 0) return { text: "比例不合法：氧+氦不能超过 100%", warn: true };
  if (he > 0) return { text: `Trimix ${o2}/${he}，注意标注 MOD 与 END`, warn: o2 > 40 };
  if (o2 > 40) return { text: `EAN${o2}，氧含量超 40%，须使用氧清洁设备`, warn: true };
  if (o2 > 21) return { text: `高氧 EAN${o2}，充填前确认气瓶氧清洁标识`, warn: false };
  return { text: "压缩空气充填", warn: false };
}

/** 检验过期判断 */
export function isInspectionOverdue(tank: Tank, today: string): boolean {
  return !!tank.inspectionDue && tank.inspectionDue < today;
}
