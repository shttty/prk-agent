import type { PublicExecutionTarget, TargetEnvironmentSnapshot } from "../../../../src/gateway/wire/web-types.ts";

/** An instance's environment as the page holds it: `settled` is the stream's last ready or failed snapshot seen. */
export type TargetEnvironmentView = TargetEnvironmentSnapshot & { settled?: TargetEnvironmentSnapshot };

export type TargetRow = Omit<PublicExecutionTarget, "environment"> & { environment?: TargetEnvironmentView };
