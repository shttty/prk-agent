import { assertLive } from "./assert-live.mjs";

export function assertRunning(ctx, owner) {
  assertLive(ctx, owner);
  if (owner.phase !== "active") throw new Error("Remote extension generation is not accepting callbacks");
}
