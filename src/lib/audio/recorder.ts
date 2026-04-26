export type RecorderResult = {
  blob: Blob;
  durationSec: number;
};

export class SessionRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private stopPromise: Promise<RecorderResult> | null = null;

  async start(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("Microphone API not available in this browser.");
    }
    // Disable DSP that mangles music: AEC, noise suppression, and AGC all
    // assume a voice signal and will pump/duck a guitar + metronome mix.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const mime = pickMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];

    this.mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    });

    this.startTime = Date.now();
    this.mediaRecorder.start(1000);
  }

  async stop(): Promise<RecorderResult> {
    if (!this.mediaRecorder) {
      throw new Error("Recorder not started.");
    }
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = new Promise<RecorderResult>((resolve) => {
      const mr = this.mediaRecorder!;
      mr.addEventListener(
        "stop",
        () => {
          const type = mr.mimeType || "audio/webm";
          const blob = new Blob(this.chunks, { type });
          const durationSec = (Date.now() - this.startTime) / 1000;
          this.releaseStream();
          resolve({ blob, durationSec });
        },
        { once: true },
      );
      if (mr.state !== "inactive") mr.stop();
    });

    return this.stopPromise;
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.releaseStream();
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private releaseStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}
