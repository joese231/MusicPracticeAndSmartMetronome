"use client";
import { byDayMinutes } from "@/lib/stats/aggregate";
import type { SessionRecord } from "@/types/sessionRecord";

type Props = {
  records: SessionRecord[];
  weeks?: number;
};

const MS_PER_DAY = 86_400_000;

function formatDay(d: Date): string {
  const yyyy = d.getFullYear().toString().padStart(4, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function bucket(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 5) return 1;
  if (minutes < 15) return 2;
  if (minutes < 30) return 3;
  return 4;
}

const COLORS = [
  "bg-bg-elevated",
  "bg-cyan-900",
  "bg-cyan-700",
  "bg-cyan-500",
  "bg-cyan-300",
];

export function CalendarHeatmap({ records, weeks = 26 }: Props) {
  const days = byDayMinutes(records);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Anchor the rightmost column to the current week (Sun-Sat).
  const dayOfWeek = today.getDay();
  const lastSat = new Date(today);
  lastSat.setDate(today.getDate() + (6 - dayOfWeek));

  const totalCells = weeks * 7;
  const start = new Date(lastSat.getTime() - (totalCells - 1) * MS_PER_DAY);

  const cells: { date: Date; key: string; minutes: number }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(start.getTime() + i * MS_PER_DAY);
    const key = formatDay(date);
    cells.push({ date, key, minutes: days.get(key) ?? 0 });
  }

  // Group into weeks (columns) so we can render column-by-column.
  const cols: typeof cells[] = [];
  for (let w = 0; w < weeks; w++) {
    cols.push(cells.slice(w * 7, w * 7 + 7));
  }

  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-300">
          Practice calendar
        </div>
        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
          <span>Less</span>
          {COLORS.map((c, i) => (
            <span key={i} className={`h-3 w-3 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-1">
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((cell) => {
              const b = bucket(cell.minutes);
              const isFuture = cell.date.getTime() > today.getTime();
              const title = isFuture
                ? cell.key
                : `${cell.key} — ${Math.round(cell.minutes)} min`;
              return (
                <div
                  key={cell.key}
                  title={title}
                  className={`h-3 w-3 rounded-sm ${isFuture ? "bg-bg" : COLORS[b]}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
