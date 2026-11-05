"use client";

import { MAX_CHUNK_BYTES } from "./backend";

/*
 * Records the participant's screen (this browser tab) and voice, and hands the
 * recording over in pieces as it goes, so a closed tab loses at most the last
 * few seconds. The pieces of one recording joined in order make a playable file.
 *
 * Kept small on purpose: about 10 frames a second at a low bitrate is plenty to
 * follow clicks on a calendar, and keeps a 10-minute session near 20 MB.
 */

export const canRecordScreen = (): boolean =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia) && typeof MediaRecorder !== "undefined";

export const canRecordMic = (): boolean => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

function pickMimeType(video: boolean): string {
  const options = video
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** Ask for the microphone. Null if they say no or there isn't one. */
export async function askMicrophone(): Promise<MediaStream | null> {
  if (!canRecordMic()) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return null;
  }
}

/**
 * Ask to share this tab. Chrome and Edge offer "this tab" first, so it's a
 * single Allow. Must be called straight from a click.
 */
export async function askScreen(): Promise<MediaStream | null> {
  if (!canRecordScreen()) return null;
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 10, max: 15 }, width: { max: 1600 }, height: { max: 1000 } },
      audio: false,
      // Chrome/Edge: offer the current tab, and don't offer to switch tabs mid-way.
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "include",
    } as DisplayMediaStreamOptions);
  } catch {
    return null;
  }
}

/** How loud the microphone is right now, 0–1, for the "we can hear you" meter. Call the returned function to stop. */
export function micLevel(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let frame = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
    onLevel(Math.min(1, peak * 2.5));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    void ctx.close();
  };
}

export interface RecorderStatus {
  bytes: number;
  savedBytes: number;
  chunks: number;
  failed: boolean;
}

/**
 * Records `screen` and `mic` (either may be missing) together, saving each piece
 * with `save(n, bytes)` in order. The whole recording is also kept in memory, so
 * it can be downloaded if saving fails.
 */
export class SessionRecorder {
  readonly mimeType: string;
  readonly startedAt = new Date().toISOString();
  private recorder: MediaRecorder;
  private pending: Blob[] = [];
  private pendingBytes = 0;
  private all: Blob[] = [];
  private queue: Promise<void> = Promise.resolve();
  private n = 0;
  private stopped: Promise<void>;
  status: RecorderStatus = { bytes: 0, savedBytes: 0, chunks: 0, failed: false };
  onChange: (s: RecorderStatus) => void = () => {};

  constructor(
    private streams: MediaStream[],
    private save: (n: number, bytes: Uint8Array) => Promise<void>,
  ) {
    const tracks = streams.flatMap((s) => s.getTracks());
    this.mimeType = pickMimeType(tracks.some((t) => t.kind === "video"));
    this.recorder = new MediaRecorder(new MediaStream(tracks), {
      mimeType: this.mimeType || undefined,
      videoBitsPerSecond: 250_000,
      audioBitsPerSecond: 32_000,
    });
    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      this.all.push(e.data);
      this.pending.push(e.data);
      this.pendingBytes += e.data.size;
      this.status = { ...this.status, bytes: this.status.bytes + e.data.size };
      this.onChange(this.status);
      if (this.pendingBytes >= MAX_CHUNK_BYTES * 0.8) this.flush();
    };
    this.stopped = new Promise((resolve) => {
      this.recorder.onstop = () => resolve();
    });
    this.recorder.start(4000);
  }

  get mime(): string {
    return this.recorder.mimeType || this.mimeType || "video/webm";
  }

  /** Save what's waiting, in pieces small enough for one document each. */
  private flush() {
    if (!this.pending.length) return;
    const blob = new Blob(this.pending, { type: this.mime });
    this.pending = [];
    this.pendingBytes = 0;
    this.queue = this.queue.then(async () => {
      // Later pieces would make a broken file without an earlier one, so after a failure nothing more is saved; the download is offered instead.
      if (this.status.failed) return;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      for (let i = 0; i < bytes.length; i += MAX_CHUNK_BYTES) {
        const part = bytes.subarray(i, i + MAX_CHUNK_BYTES);
        try {
          await this.save(this.n, part);
        } catch {
          this.status = { ...this.status, failed: true };
          this.onChange(this.status);
          return;
        }
        this.n += 1;
        this.status = { ...this.status, savedBytes: this.status.savedBytes + part.length, chunks: this.n };
        this.onChange(this.status);
      }
    });
  }

  /** Stop recording and wait until every piece is saved (or saving has failed). */
  async stop(): Promise<void> {
    if (this.recorder.state !== "inactive") this.recorder.stop();
    await this.stopped;
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    this.flush();
    await this.queue;
  }

  /** The whole recording, from memory. */
  blob(): Blob {
    return new Blob(this.all, { type: this.mime });
  }
}
