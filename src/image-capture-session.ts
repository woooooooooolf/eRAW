export interface CaptureJob {
  readonly revision: number;
  check(): void;
  commit(): void;
  cancel(): void;
  finish(): void;
}

export class CaptureCancelledError extends Error {
  readonly code = "capture_cancelled";
  constructor() { super("capture_cancelled"); }
}

/** One capture operation; presentation changes invalidate it before native output. */
export class ImageCaptureSession {
  private revision = 0;
  private active: { revision: number; committed: boolean } | null = null;
  constructor(private readonly onCancel: (revision: number) => void = () => {}) {}

  invalidate(): void {
    if (!this.active || this.active.committed) return;
    this.active = null;
    this.onCancel(++this.revision);
  }

  begin(): CaptureJob {
    this.invalidate();
    const active = { revision: ++this.revision, committed: false };
    this.active = active;
    const check = () => {
      if (this.active !== active || active.committed) throw new CaptureCancelledError();
    };
    return {
      revision: active.revision,
      check,
      commit: () => { check(); active.committed = true; },
      cancel: () => { if (this.active === active) this.invalidate(); },
      finish: () => { if (this.active === active) this.active = null; },
    };
  }
}
