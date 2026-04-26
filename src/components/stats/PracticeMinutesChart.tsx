"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SessionRecord } from "@/types/sessionRecord";
import { byDayMinutes } from "@/lib/stats/aggregate";

type Props = {
  records: SessionRecord[];
  days?: number;
  height?: number;
};

const MS_PER_DAY = 86_400_000;

function formatDay(d: Date): string {
  const yyyy = d.getFullYear().toString().padStart(4, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function PracticeMinutesChart({
  records,
  days = 30,
  height = 200,
}: Props) {
  const map = byDayMinutes(records);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const data: { day: string; label: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY);
    const key = formatDay(d);
    data.push({
      day: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: Math.round((map.get(key) ?? 0) * 10) / 10,
    });
  }

  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated p-4">
      <div className="mb-2 text-sm font-semibold text-neutral-300">
        Daily practice (last {days} days)
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#71717a" fontSize={10} interval={Math.floor(days / 10)} />
          <YAxis stroke="#71717a" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 6,
              color: "#e5e5e5",
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v} min`, "Practice"]}
          />
          <Bar dataKey="minutes" fill="#22d3ee" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
