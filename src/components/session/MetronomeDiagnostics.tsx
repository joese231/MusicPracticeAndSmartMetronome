"use client";
import { useEffect, useState } from "react";
import {
  getMetronomeDebugStats,
  type Metronome,
  type MetronomeDiagnostics,
  type MetronomeDebugStats,
} from "@/lib/metronome/scheduler";

type Props = {
  metronome: Metronome | null;
};

/**
 * Debug-only overlay that surfaces the metronome's internal state so a live
 * "weird click" complaint can be diagnosed without another analysis round.
 * Only rendered when the session URL carries `?debug=1`.
 */
export function MetronomeDiagnosticsPanel({ metronome }: Props) {
  const [d, setD] = useState<MetronomeDiagnostics | null>(null);
  const [dbg, setDbg] = useState<MetronomeDebugStats | null>(null);

  useEffect(() => {
    if (!metronome) return;
    let raf = 0;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      setD(metronome.getDiagnostics());
      setDbg(getMetronomeDebugStats());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [metronome]);

  if (!d) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 rounded-lg border border-accent/40 bg-black/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-200 shadow-lg">
      <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-accent">
        Metronome debug
      </div>
      <Row k="instance" v={String(d.instanceId)} />
      <Row k="running" v={d.running ? "yes" : "no"} />
      <Row k="ctx" v={d.ctxState} />
      <Row k="bpm" v={String(d.bpm)} />
      <Row k="mode" v={d.mode} />
      <Row k="accents" v={d.accentsEnabled ? "on" : "off"} />
      <Row k="beat" v={String(d.beatIndex)} />
      <Row k="lastVoice" v={d.lastVoice ?? "—"} />
      <Row k="gain" v={d.masterGainValue.toFixed(3)} />
      <Row k="aligns" v={String(d.alignCount)} />
      <Row k="lateTicks" v={String(d.lateTickCount)} />
      {dbg && (
        <>
          <div className="mt-2 border-t border-neutral-700 pt-1 text-[10px] uppercase tracking-[0.2em] text-accent">
            Collisions
          </div>
          <Row
            k="count"
            v={
              dbg.collisionCount > 0
                ? `⚠ ${dbg.collisionCount}`
                : String(dbg.collisionCount)
            }
          />
          {dbg.lastCollision && (
            <>
              <Row
                k="last gap"
                v={`${dbg.lastCollision.gapMs.toFixed(1)}ms`}
              />
              <Row
                k="last src"
                v={
                  dbg.lastCollision.a.instanceId ===
                  dbg.lastCollision.b.instanceId
                    ? `same #${dbg.lastCollision.a.instanceId}`
                    : `#${dbg.lastCollision.a.instanceId} vs #${dbg.lastCollision.b.instanceId}`
                }
              />
              <Row
                k="last voices"
                v={`${dbg.lastCollision.a.voice}/${dbg.lastCollision.b.voice}`}
              />
            </>
          )}
          <div className="mt-2 border-t border-neutral-700 pt-1 text-[10px] uppercase tracking-[0.2em] text-accent">
            Timing
          </div>
          <Row
            k="jitter events"
            v={
              dbg.jitterCount > 0
                ? `⚠ ${dbg.jitterCount}`
                : String(dbg.jitterCount)
            }
          />
          <Row k="max |Δ|" v={`${dbg.maxJitterMs.toFixed(2)}ms`} />
          <Row
            k="past-sched"
            v={
              dbg.pastScheduleCount > 0
                ? `⚠ ${dbg.pastScheduleCount}`
                : String(dbg.pastScheduleCount)
            }
          />
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-neutral-500">{k}</span>
      <span className="text-neutral-100">{v}</span>
    </div>
  );
}
