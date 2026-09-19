// ============================================================
// 种子数据：首次启动时构造一份可演示交接闭环的初始状态
// ============================================================

import { AppState, FillRecord, Shift } from "../domain/types";

const isoDaysAgo = (days: number, hour = 8) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
};

const datePlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function seedState(): AppState {
  const tanks = [
    { id: "tank-204", code: "TANK-204", volume: "12L 铝瓶", inspectionDue: datePlusDays(400) },
    { id: "tank-219", code: "TANK-219", volume: "11L 钢瓶", inspectionDue: datePlusDays(12) },
    { id: "tank-231", code: "TANK-231", volume: "双瓶组 2×12L", inspectionDue: datePlusDays(-20) },
    { id: "tank-112", code: "TANK-112", volume: "10L 钢瓶", inspectionDue: datePlusDays(200) },
  ];
  const equipment = [
    { id: "eq-comp-a", name: "空压机 A" },
    { id: "eq-panel", name: "混气面板" },
    { id: "eq-boost-b", name: "增压泵 B" },
  ];

  const yesterday: Shift = {
    id: "shift-yesterday",
    label: "昨日 晚班",
    operator: "陈海",
    startedAt: isoDaysAgo(1, 18),
    status: "locked",
    lockedAt: isoDaysAgo(0, 8),
    snapshot: {
      shiftId: "shift-yesterday",
      label: "昨日 晚班",
      operator: "陈海",
      startedAt: isoDaysAgo(1, 18),
      lockedAt: isoDaysAgo(0, 8),
      signedCount: 1,
      signedFills: [
        {
          fillId: "fill-y1",
          tankCode: "TANK-112",
          summary: "空气 O₂21% → 200bar，签收人 林教练",
        },
      ],
    },
  };

  const today: Shift = {
    id: "shift-current",
    label: "今日 早班",
    operator: "王潜",
    startedAt: isoDaysAgo(0, 8),
    status: "open",
  };

  const fillYesterday: FillRecord = {
    id: "fill-y1",
    tankId: "tank-112",
    shiftId: yesterday.id,
    residualBar: 30,
    targetBar: 200,
    o2Percent: 21,
    hePercent: 0,
    method: "空气",
    operator: "陈海",
    equipmentId: "eq-comp-a",
    status: "signed",
    rework: null,
    signedBy: "林教练",
    signedAt: isoDaysAgo(1, 21),
    createdAt: isoDaysAgo(1, 19),
    events: [
      { at: isoDaysAgo(1, 19), type: "created", actor: "陈海", note: "登记充填 压缩空气，目标 200bar" },
      { at: isoDaysAgo(1, 19), type: "started", actor: "陈海", note: "开始充填" },
      { at: isoDaysAgo(1, 20), type: "completed", actor: "陈海", note: "充填完成，待签收（200bar）" },
      { at: isoDaysAgo(1, 21), type: "signed", actor: "林教练", note: "签收完成" },
    ],
  };

  const fillQueued: FillRecord = {
    id: "fill-q1",
    tankId: "tank-204",
    shiftId: today.id,
    residualBar: 55,
    targetBar: 200,
    o2Percent: 21,
    hePercent: 0,
    method: "空气",
    operator: "王潜",
    equipmentId: "eq-comp-a",
    status: "queued",
    rework: null,
    signedBy: null,
    signedAt: null,
    createdAt: isoDaysAgo(0, 9),
    events: [
      { at: isoDaysAgo(0, 9), type: "created", actor: "王潜", note: "登记充填 压缩空气，目标 200bar" },
    ],
  };

  const fillFilling: FillRecord = {
    id: "fill-f1",
    tankId: "tank-219",
    shiftId: today.id,
    residualBar: 40,
    targetBar: 200,
    o2Percent: 32,
    hePercent: 0,
    method: "高氧",
    operator: "王潜",
    equipmentId: "eq-panel",
    status: "filling",
    rework: null,
    signedBy: null,
    signedAt: null,
    createdAt: isoDaysAgo(0, 9),
    events: [
      { at: isoDaysAgo(0, 9), type: "created", actor: "王潜", note: "登记充填 EAN32，目标 200bar" },
      { at: isoDaysAgo(0, 10), type: "started", actor: "王潜", note: "开始充填" },
    ],
  };

  const fillCompleted: FillRecord = {
    id: "fill-c1",
    tankId: "tank-112",
    shiftId: today.id,
    residualBar: 20,
    targetBar: 220,
    o2Percent: 36,
    hePercent: 0,
    method: "高氧",
    operator: "王潜",
    equipmentId: "eq-panel",
    status: "completed",
    rework: null,
    signedBy: null,
    signedAt: null,
    createdAt: isoDaysAgo(0, 8),
    events: [
      { at: isoDaysAgo(0, 8), type: "created", actor: "王潜", note: "登记充填 EAN36，目标 220bar" },
      { at: isoDaysAgo(0, 8), type: "started", actor: "王潜", note: "开始充填" },
      { at: isoDaysAgo(0, 9), type: "completed", actor: "王潜", note: "充填完成，待签收（220bar）" },
    ],
  };

  return {
    version: 1,
    tanks,
    equipment,
    fills: [fillYesterday, fillQueued, fillFilling, fillCompleted],
    cleaningOrders: [
      {
        id: "clean-1",
        tankId: "tank-231",
        reason: "双瓶组年度氧清洗",
        status: "pending",
        shiftId: today.id,
        createdAt: isoDaysAgo(0, 8),
      },
    ],
    shifts: [yesterday, today],
    handovers: [
      {
        id: "handover-seed",
        fromShiftId: yesterday.id,
        toShiftId: today.id,
        fromOperator: "陈海",
        toOperator: "王潜",
        createdAt: isoDaysAgo(0, 7),
        status: "confirmed",
        confirmedAt: isoDaysAgo(0, 8),
        items: [],
      },
    ],
    corrections: [],
    currentShiftId: today.id,
  };
}
