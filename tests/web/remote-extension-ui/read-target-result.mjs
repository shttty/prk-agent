import { decode } from "../../../src/remote-extensions/codec/decode.mjs";

export async function readTargetResult(events, token) {
  for (const event of await events()) {
    if (event.t !== "frame" || event.frame?.kind !== "reply" || !Object.hasOwn(event.frame, "result")) continue;
    const value = decode(event.frame.result);
    if (value?.details?.fixture === "remote-extension-ui" && value.details.token === token) return value.details;
  }
}
