import type { PtyEntry } from "./terminal-state.ts";
import { publishEvent } from "./publish-event.ts";
import { readHandshake } from "./read-handshake.ts";

export function receiveOutput(entry: PtyEntry, bytes: Uint8Array): void {
  if (entry.closed) return;
  const data = readHandshake(entry, entry.decoder.decode(bytes, { stream: true }));
  if (!data) return;
  entry.replay.append(data);
  if (entry.integration !== "ready") {
    const markers = entry.markerTail + data;
    entry.markerTail = markers.slice(-12);
    if (/\x1b\]133;B(?:\x07|\x1b\\)/u.test(markers)) {
      entry.integration = "ready";
      entry.finishIntegration();
    }
  }
  publishEvent(entry, { type: "stdout", data });
}
