import type { MessageKey } from "./i18n";

export const LATEST_RELEASE_URL = "https://github.com/woooooooooolf/eRAW/releases/latest";
export type UpdateFailure = "timeout" | "network" | "rate_limited" | "no_release" | "invalid_response" | "busy";
export type UpdateResult =
  | { status: "current" }
  | { status: "available"; version: string; downloadAvailable: boolean; releaseUrl: string; downloadUrl: string | null }
  | { status: "failed"; reason: UpdateFailure };
export type UpdateCheckStatus = { status: "idle" } | { status: "checking" } | UpdateResult;

/** Application-lifetime state; dialog visibility does not own or cancel the task. */
export class ManualUpdateChecker {
  private value: UpdateCheckStatus = { status: "idle" };
  private pending: Promise<void> | null = null;

  constructor(
    private readonly request: () => Promise<UpdateResult>,
    private readonly changed: () => void,
    private readonly deadlineMs = 10_000,
  ) {}

  get state(): UpdateCheckStatus { return this.value; }

  check(): Promise<void> {
    if (this.pending) return this.pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<UpdateResult>((resolve) => {
      timer = setTimeout(() => resolve({ status: "failed", reason: "timeout" }), this.deadlineMs);
    });
    const request = Promise.resolve().then(() => this.request())
      .catch((): UpdateResult => ({ status: "failed", reason: "network" }));
    this.pending = Promise.race([request, deadline]).then((result) => {
      this.value = result;
      this.changed();
    }).finally(() => {
      clearTimeout(timer);
      this.pending = null;
    });
    this.value = { status: "checking" };
    this.changed();
    return this.pending;
  }
}

export function updateCheckMessage(state: UpdateCheckStatus): { key: MessageKey; values?: { version: string } } {
  if (state.status === "idle") return { key: "update.check" };
  if (state.status === "checking") return { key: "update.progress" };
  if (state.status === "current") return { key: "update.current" };
  if (state.status === "available") return {
    key: state.downloadAvailable ? "update.available" : "update.unconfirmed",
    values: { version: state.version },
  };
  const keys: Record<UpdateFailure, MessageKey> = {
    timeout: "update.failed.timeout", network: "update.failed.network", rate_limited: "update.failed.rateLimited",
    no_release: "update.failed.noRelease", invalid_response: "update.failed.invalidResponse", busy: "update.failed.busy",
  };
  return { key: keys[state.reason] ?? "update.failed.network" };
}
