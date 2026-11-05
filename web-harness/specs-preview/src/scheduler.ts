import type { ViroSpecsCancel, ViroSpecsHostScheduler } from "./vendor/lens-core/ViroSpecsSceneBackend";

type Job = { callback: () => void; cancelled: boolean; at?: number };

/**
 * Frame clock for the controller and the backend. The render loop calls
 * {@linkcode FrameScheduler.tick} once per frame; tests call it by hand, so
 * Node runs see the same ordering as the browser. Callbacks never run inside
 * the call that scheduled them, matching the Lens DelayedCallbackEvent.
 */
export class FrameScheduler implements ViroSpecsHostScheduler {
  private frame: Job[] = [];
  private timers: Job[] = [];
  private timeMs = 0;

  nextFrame(callback: () => void): ViroSpecsCancel {
    const job: Job = { callback, cancelled: false };
    this.frame.push(job);
    return () => {
      job.cancelled = true;
    };
  }

  after(seconds: number, callback: () => void): ViroSpecsCancel {
    const job: Job = { callback, cancelled: false, at: this.timeMs + seconds * 1000 };
    this.timers.push(job);
    return () => {
      job.cancelled = true;
    };
  }

  nowMs(): number {
    return this.timeMs;
  }

  /** Jobs still queued and not cancelled. */
  get queued(): number {
    return [...this.frame, ...this.timers].filter((j) => !j.cancelled).length;
  }

  /** Advances one frame of `ms` milliseconds and runs what is due. */
  tick(ms: number): void {
    this.timeMs += ms;
    const frame = this.frame;
    this.frame = [];
    for (const job of frame) if (!job.cancelled) job.callback();
    const due = this.timers.filter((j) => (j.at ?? 0) <= this.timeMs);
    this.timers = this.timers.filter((j) => (j.at ?? 0) > this.timeMs);
    for (const job of due) if (!job.cancelled) job.callback();
  }
}
