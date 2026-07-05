import { afterEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "@/types/exercise";
import type { Song } from "@/types/song";
import { FileRepository } from "./fileRepository";

describe("FileRepository statistics resets", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("clears the practice-time mirror when resetting statistics", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      return Response.json({ ok: true });
    }) as typeof fetch;

    await new FileRepository().resetAllStatistics();

    expect(calls).toEqual([{ url: "/api/statistics/reset", method: "POST" }]);
  });

  it("clears the practice-time mirror when factory resetting", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    global.fetch = vi.fn(async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      return Response.json({ ok: true });
    }) as typeof fetch;

    await new FileRepository().factoryReset();

    expect(calls).toEqual([{ url: "/api/factory-reset", method: "POST" }]);
  });

  it("uses the complete-session endpoint for live session completion", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({ ok: true });
    }) as typeof fetch;

    await new FileRepository().completeSession({
      id: "session-1",
      itemId: "song-1",
      itemKind: "song",
      itemTitle: "Test song",
      startedAt: "2026-06-11T12:00:00.000Z",
      endedAt: "2026-06-11T12:05:00.000Z",
      durationSec: 300,
      endedReason: "complete",
      plannedMinutes: 5,
      startTroubleBpms: [],
      endTroubleBpms: [],
      promotions: [],
    });

    expect(calls).toEqual([
      {
        url: "/api/sessions/complete",
        method: "POST",
        body: {
          record: expect.objectContaining({
            id: "session-1",
            durationSec: 300,
          }),
        },
      },
    ]);
  });

  it("routes item manual session appends through the item-total endpoint", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({ ok: true });
    }) as typeof fetch;

    await new FileRepository().appendSession({
      id: "manual-1",
      itemId: "song-1",
      itemKind: "song",
      itemTitle: "Test song",
      startedAt: "2026-06-11T12:00:00.000Z",
      endedAt: "2026-06-11T12:05:00.000Z",
      durationSec: 300,
      endedReason: "manual",
      plannedMinutes: 5,
      startTroubleBpms: [],
      endTroubleBpms: [],
      promotions: [],
    });

    expect(calls).toEqual([
      {
        url: "/api/sessions/complete",
        method: "POST",
        body: {
          record: expect.objectContaining({
            id: "manual-1",
            itemKind: "song",
            durationSec: 300,
          }),
        },
      },
    ]);
  });

  it("keeps free-play session appends append-only", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({ ok: true });
    }) as typeof fetch;

    await new FileRepository().appendSession({
      id: "free-1",
      itemId: "__freeplay__",
      itemKind: "freePlay",
      itemTitle: "Free Play",
      startedAt: "2026-06-11T12:00:00.000Z",
      endedAt: "2026-06-11T12:05:00.000Z",
      durationSec: 300,
      endedReason: "manual",
      plannedMinutes: 0,
      startTroubleBpms: [],
      endTroubleBpms: [],
      promotions: [],
    });

    expect(calls).toEqual([
      {
        url: "/api/sessions",
        method: "POST",
        body: expect.objectContaining({
          id: "free-1",
          itemKind: "freePlay",
          durationSec: 300,
        }),
      },
    ]);
  });

  it("uses a delta endpoint for practice-time adjustments", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({ totalPracticeSec: 80 });
    }) as typeof fetch;

    const total = await new FileRepository().adjustPracticeTime(
      "song",
      "song-1",
      -20,
    );

    expect(total).toBe(80);
    expect(calls).toEqual([
      {
        url: "/api/practice-time",
        method: "PATCH",
        body: { itemKind: "song", itemId: "song-1", deltaSec: -20 },
      },
    ]);
  });

  it("uses narrow song endpoints for create, edit, delete, and reorder", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (url === "/api/songs" && method === "GET") {
        return Response.json(
          calls.filter((call) => call.url === "/api/songs" && call.method === "GET")
            .length === 1
            ? []
            : [baseSong],
        );
      }
      return Response.json({ ok: true });
    }) as typeof fetch;

    const baseSong: Song = {
      id: "song-1",
      title: "Title",
      link: null,
      workingBpm: 90,
      warmupBpm: null,
      troubleSpots: [],
      originalBpm: null,
      stepPercent: 2.5,
      practiceMode: "timed",
      includeWarmupBlock: true,
      blockTemplate: [],
      defaultSessionMinutes: 10,
      metronomeEnabled: true,
      totalPracticeSec: 100,
      sortIndex: 0,
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:00:00.000Z",
    };

    const repo = new FileRepository();
    await repo.upsertSong(baseSong);
    await repo.upsertSong({
      ...baseSong,
      title: "Edited",
      totalPracticeSec: 0,
      updatedAt: "2026-06-12T00:01:00.000Z",
    });
    await repo.deleteSong("song-1");
    await repo.reorderSongs(["song-1"]);

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["GET", "/api/songs"],
      ["POST", "/api/songs"],
      ["GET", "/api/songs"],
      ["PATCH", "/api/songs/song-1"],
      ["DELETE", "/api/songs/song-1"],
      ["PATCH", "/api/songs/reorder"],
    ]);
    expect(calls[3].body).toEqual({
      expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
      patch: expect.not.objectContaining({
        id: expect.anything(),
        createdAt: expect.anything(),
        totalPracticeSec: expect.anything(),
      }),
    });
    expect((calls[3].body as { patch: Record<string, unknown> }).patch).not.toHaveProperty(
      "sortIndex",
    );
  });

  it("uses narrow exercise endpoints for create, edit, delete, and reorder", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (url === "/api/exercises" && method === "GET") {
        return Response.json(
          calls.filter(
            (call) => call.url === "/api/exercises" && call.method === "GET",
          ).length === 1
            ? []
            : [baseExercise],
        );
      }
      return Response.json({ ok: true });
    }) as typeof fetch;

    const baseExercise: Exercise = {
      id: "exercise-1",
      name: "Roll",
      link: null,
      notes: null,
      workingBpm: 80,
      warmupBpm: null,
      stepPercent: 2.5,
      sessionMinutes: 5,
      openEnded: false,
      metronomeEnabled: true,
      practiceMode: "timed",
      includeWarmupBlock: true,
      blockTemplate: [],
      totalPracticeSec: 100,
      sortIndex: 0,
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:00:00.000Z",
    };

    const repo = new FileRepository();
    await repo.upsertExercise(baseExercise);
    await repo.upsertExercise({
      ...baseExercise,
      name: "Edited",
      totalPracticeSec: 0,
      updatedAt: "2026-06-12T00:01:00.000Z",
    });
    await repo.deleteExercise("exercise-1");
    await repo.reorderExercises(["exercise-1"]);

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["GET", "/api/exercises"],
      ["POST", "/api/exercises"],
      ["GET", "/api/exercises"],
      ["PATCH", "/api/exercises/exercise-1"],
      ["DELETE", "/api/exercises/exercise-1"],
      ["PATCH", "/api/exercises/reorder"],
    ]);
    expect(calls[3].body).toEqual({
      expectedUpdatedAt: "2026-06-12T00:00:00.000Z",
      patch: expect.not.objectContaining({
        id: expect.anything(),
        createdAt: expect.anything(),
        totalPracticeSec: expect.anything(),
      }),
    });
    expect((calls[3].body as { patch: Record<string, unknown> }).patch).not.toHaveProperty(
      "sortIndex",
    );
  });
});
