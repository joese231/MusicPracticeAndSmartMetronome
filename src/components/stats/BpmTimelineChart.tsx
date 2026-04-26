"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { SessionRecord } from "@/types/sessionRecord";
import { bpmTimeline } from "@/lib/stats/aggregate";

type Props = {
  records: SessionRecord[];
  itemId: string;
  troubleSpotCount?: number;
  height?: number;
};

const TROUBLE_COLORS = ["#f87171", "#fbbf24", "#a78bfa", "#34d399", "#60a5fa"];

export function BpmTimelineChart({
  records,
  itemId,
  troubleSpotCount = 0,
  height = 240,
}: Props) {
  const points = bpmTimeline(records, itemId);
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-bg-border bg-bg-elevated/50 p-6 text-center text-sm text-neutral-500">
        No sessions recorded yet — finish one to see your BPM curve here.
      </div>
    );
  }
  type Row = {
    at: string;
    label: string;
    workingBpm: number;
  } & Record<string, number | string>;
  const data: Row[] = points.map((p) => {
    const d = new Date(p.at);
    const row: Row = {
      at: p.at,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      workingBpm: p.workingBpm,
    };
    for (let i = 0; i < troubleSpotCount; i++) {
      const v = p.troubleBpms[i];
      if (typeof v === "number") row[`trouble${i}`] = v;
    }
    return row;
  });

  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated p-4">
      <div className="mb-2 text-sm font-semibold text-neutral-300">
        BPM over time
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} />
          <YAxis stroke="#71717a" fontSize={11} domain={["dataMin - 5", "dataMax + 5"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 6,
              color: "#e5e5e5",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="workingBpm"
            name="Working"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          {Array.from({ length: troubleSpotCount }).map((_, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`trouble${i}`}
              name={troubleSpotCount > 1 ? `Trouble ${i + 1}` : "Trouble"}
              stroke={TROUBLE_COLORS[i % TROUBLE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
