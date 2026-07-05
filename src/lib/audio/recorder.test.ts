import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionRecorder } from "./recorder";

const originalNavigator = globalThis.navigator;
const originalMediaRecorder = globalThis.MediaRecorder;

type FakeRecorderMode = "inactive-on-start" | "error-on-stop";

class FakeTrack {
  stop = vi.fn();
}

function installRecorderFakes(mode: FakeRecorderMode) {
  const track = new FakeTrack();
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;

  class FakeMediaRecorder extends EventTarget {
    static isTypeSupported = () => true;
    mimeType = "audio/webm";
    state: RecordingState = "inactive";

    constructor(
      _stream: MediaStream,
      _options?: MediaRecorderOptions,
    ) {
      super();
    }

    start() {
      this.state = mode === "inactive-on-start" ? "inactive" : "recording";
    }

    stop() {
      this.state = "inactive";
      if (mode === "error-on-stop") {
        const event = Object.assign(new Event("error"), {
          error: new Error("recorder failed"),
        });
        this.dispatchEvent(event);
        return;
      }
      this.dispatchEvent(new Event("stop"));
    }
  }

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    },
  });
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: FakeMediaRecorder,
  });

  return { track };
}

function timeout<T>(promise: Promise<T>): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 20)),
  ]);
}

describe("SessionRecorder", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
    });
  });

  it("resolves stop when the recorder is already inactive", async () => {
    const { track } = installRecorderFakes("inactive-on-start");
    const recorder = new SessionRecorder();
    await recorder.start();

    const result = await timeout(recorder.stop());

    expect(result).not.toBe("timeout");
    expect(result).toMatchObject({ durationSec: expect.any(Number) });
    expect(track.stop).toHaveBeenCalled();
  });

  it("rejects stop when the recorder emits an error", async () => {
    const { track } = installRecorderFakes("error-on-stop");
    const recorder = new SessionRecorder();
    await recorder.start();

    await expect(timeout(recorder.stop().catch((err) => err))).resolves.toBeInstanceOf(
      Error,
    );
    expect(track.stop).toHaveBeenCalled();
  });
});
