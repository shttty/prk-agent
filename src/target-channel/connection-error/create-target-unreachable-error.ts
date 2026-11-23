/** A connection failure, not a target-side kernel/scope prerequisite failure. */
export class TargetUnreachableError extends Error {
  readonly code = "TARGET_UNREACHABLE";
  readonly details: { reason: "connection" | "deployment" | "timeout" };
  constructor(target: string, url?: string, cause?: unknown) {
    const endpoint = url === undefined ? undefined : new URL(url);
    const host = endpoint ? `${endpoint.hostname}:${endpoint.port || (endpoint.protocol === "https:" ? "443" : "80")}` : undefined;
    super(`目标不可达：${target}${host ? ` (${host})` : ""}。`, { cause });
    this.name = "TargetUnreachableError";
    const reason = typeof cause === "object" && cause !== null && "reason" in cause ? cause.reason : undefined;
    this.details = { reason: reason === "deployment" || reason === "timeout" ? reason : "connection" };
  }
}
