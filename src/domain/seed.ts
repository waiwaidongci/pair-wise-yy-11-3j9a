// ============================================================
// 演示种子数据：首次启动（无本地存储）时使用。
// ============================================================

import type { AppState } from "./types";

export function seedState(now: string): AppState {
  return {
    seq: 10,
    tanks: [
      { id: "TK-0002", code: "TANK-204", volume: "12L 铝瓶", inspectionDue: "2027-03-01" },
      { id: "TK-0003", code: "TANK-219", volume: "11L 钢瓶", inspectionDue: "2026-10-01" },
      { id: "TK-0004", code: "TANK-231", volume: "双瓶组 2×12L", inspectionDue: "2026-09-25" },
      { id: "TK-0005", code: "TANK-118", volume: "10L 钢瓶", inspectionDue: "2026-08-30" },
    ],
    fills: [
      {
        id: "FL-0006",
        tankId: "TK-0002",
        shiftId: "SH-0001",
        residualBar: 55,
        targetBar: 200,
        o2: 21,
        he: 0,
        mode: "空气",
        equipmentId: "压缩机-A",
        operator: "王岚",
        status: "queued",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "FL-0007",
        tankId: "TK-0003",
        shiftId: "SH-0001",
        residualBar: 30,
        targetBar: 200,
        o2: 32,
        he: 0,
        mode: "高氧",
        equipmentId: "膜分离机-B",
        operator: "王岚",
        status: "filling",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "FL-0008",
        tankId: "TK-0004",
        shiftId: "SH-0001",
        residualBar: 40,
        targetBar: 220,
        o2: 21,
        he: 35,
        mode: "Trimix",
        equipmentId: "压缩机-A",
        operator: "王岚",
        status: "filled",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "FL-0009",
        tankId: "TK-0005",
        shiftId: "SH-0001",
        residualBar: 20,
        targetBar: 200,
        o2: 21,
        he: 0,
        mode: "空气",
        equipmentId: "压缩机-C",
        operator: "王岚",
        status: "signed",
        createdAt: now,
        updatedAt: now,
        signedAt: now,
      },
    ],
    reworks: [],
    cleanings: [
      {
        id: "CL-0010",
        tankId: "TK-0005",
        note: "瓶口螺纹清洗",
        status: "pending",
        createdAt: now,
      },
    ],
    shifts: [
      {
        id: "SH-0001",
        label: "早班",
        operator: "王岚",
        status: "active",
        startedAt: now,
      },
    ],
    corrections: [],
  };
}
