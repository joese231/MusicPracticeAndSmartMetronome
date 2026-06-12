import type { BlockDurationRule } from "@/types/song";

type DurationRow = {
  id: string;
  duration: BlockDurationRule;
};

export type DurationAllocationResult =
  | {
      ok: true;
      durations: Map<string, number>;
      fixedSec: number;
      remainingSec: number;
    }
  | {
      ok: false;
      reason: "fixed-exceeds-total";
      fixedSec: number;
      totalSec: number;
    }
  | {
      ok: false;
      reason: "fixed-underfills-total";
      fixedSec: number;
      totalSec: number;
    }
  | {
      ok: false;
      reason: "percent-exceeds-100";
      id: string;
      percent: number;
    }
  | {
      ok: false;
      reason: "no-positive-percent";
      fixedSec: number;
      remainingSec: number;
    };

export type DurationPlanValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "fixed-exceeds-total";
      fixedSec: number;
      totalSec: number;
    }
  | {
      ok: false;
      reason: "fixed-underfills-total";
      fixedSec: number;
      totalSec: number;
    }
  | {
      ok: false;
      reason: "percent-exceeds-100";
      id: string;
      percent: number;
    }
  | {
      ok: false;
      reason: "no-positive-percent";
      fixedSec: number;
      remainingSec: number;
    };

export function validateBlockDurationPlan(
  totalSec: number,
  rows: DurationRow[],
): DurationPlanValidationResult {
  const roundedTotal = Math.max(0, Math.round(totalSec));
  let fixedSec = 0;
  let hasPercent = false;

  for (const row of rows) {
    if (row.duration.kind === "fixed") {
      fixedSec += Math.max(0, Math.round(row.duration.seconds));
      continue;
    }
    const percent = Math.max(0, row.duration.percent);
    if (percent > 100) {
      return {
        ok: false,
        reason: "percent-exceeds-100",
        id: row.id,
        percent,
      };
    }
    if (percent > 0) hasPercent = true;
  }

  if (fixedSec > roundedTotal) {
    return {
      ok: false,
      reason: "fixed-exceeds-total",
      fixedSec,
      totalSec: roundedTotal,
    };
  }

  const remainingSec = roundedTotal - fixedSec;
  if (hasPercent) return { ok: true };
  if (remainingSec === 0) return { ok: true };

  if (rows.some((row) => row.duration.kind === "percent")) {
    return {
      ok: false,
      reason: "no-positive-percent",
      fixedSec,
      remainingSec,
    };
  }

  return {
    ok: false,
    reason: "fixed-underfills-total",
    fixedSec,
    totalSec: roundedTotal,
  };
}

export function allocateBlockDurations(
  totalSec: number,
  rows: DurationRow[],
): DurationAllocationResult {
  const roundedTotal = Math.max(0, Math.round(totalSec));
  const durations = new Map<string, number>();
  let fixedSec = 0;
  const percentRows: DurationRow[] = [];

  for (const row of rows) {
    if (row.duration.kind === "fixed") {
      const seconds = Math.max(0, Math.round(row.duration.seconds));
      durations.set(row.id, seconds);
      fixedSec += seconds;
    } else {
      percentRows.push(row);
    }
  }

  if (fixedSec > roundedTotal) {
    return {
      ok: false,
      reason: "fixed-exceeds-total",
      fixedSec,
      totalSec: roundedTotal,
    };
  }

  const remainingSec = roundedTotal - fixedSec;
  if (percentRows.length === 0) {
    return { ok: true, durations, fixedSec, remainingSec };
  }

  const totalPercent = percentRows.reduce(
    (sum, row) => {
      if (row.duration.kind !== "percent") return sum;
      return (
        sum +
        Math.max(0, Math.round(row.duration.percent * 1_000_000) / 1_000_000)
      );
    },
    0,
  );
  if (totalPercent <= 0) {
    return {
      ok: false,
      reason: "no-positive-percent",
      fixedSec,
      remainingSec,
    };
  }

  let allocatedPercentSec = 0;
  for (const row of percentRows) {
    if (row.duration.kind !== "percent") continue;
    const percent = Math.max(0, row.duration.percent);
    const seconds = Math.floor((percent / totalPercent) * remainingSec);
    durations.set(row.id, seconds);
    allocatedPercentSec += seconds;
  }

  const residual = remainingSec - allocatedPercentSec;
  if (residual !== 0) {
    const firstPercent = percentRows[0];
    durations.set(firstPercent.id, (durations.get(firstPercent.id) ?? 0) + residual);
  }

  return {
    ok: true,
    durations,
    fixedSec,
    remainingSec,
  };
}

export function allocateValidatedBlockDurations(
  totalSec: number,
  rows: DurationRow[],
): DurationAllocationResult {
  const validation = validateBlockDurationPlan(totalSec, rows);
  if (!validation.ok) return validation;
  return allocateBlockDurations(totalSec, rows);
}
