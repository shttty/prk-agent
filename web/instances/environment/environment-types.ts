import type { TargetEnvironmentSnapshot } from "../../../src/gateway/wire/web-types.ts";

/** An instance's remote environment as the workbench holds it: the Gateway's state plus, on the same stream, the outcome of the last task. */
export type TargetEnvironment = TargetEnvironmentSnapshot & { settled?: TargetEnvironmentSnapshot };

/** This page's own reason to stop waiting for a deploy, or the deploy's failure. */
export type EnvironmentFailure = { kind: string; code?: string; message: string; details?: Record<string, unknown> };
