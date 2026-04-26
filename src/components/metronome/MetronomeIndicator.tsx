"use client";
import { useEffect, useRef, useState } from "react";
import type { Metronome } from "@/lib/metronome/scheduler";

export function MetronomeIndicator({ metronome }: { metronome: Metronome | null }) {
  const [pulse, setPulse] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!metronome) return;
    const unsub = metronome.onBeat((beatIndex) => {
      setPulse((p) => p + 1);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // no-op; state change already triggers the animation reset via key
      }, 100);
      void beatIndex;
    });
    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [metronome]);

  return (
    <div className="flex items-center justify-center">
      <div
        key={pulse}
        className="h-4 w-4 rounded-full bg-accent metronome-pulse"
        aria-hidden
      />
      <style jsx>{`
        .metronome-pulse {
          animation: pulse 160ms ease-out;
        }
        @keyframes pulse {
          0% {
            transform: scale(1.8);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}
