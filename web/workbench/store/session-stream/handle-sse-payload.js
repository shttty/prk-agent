import { isRecord } from "../../payloads/is-record.js";
import { ingestSnapshot } from "./ingest-snapshot.js";
import { handleHostEvent } from "./handle-host-event.js";
export function handleSsePayload(ctx, payload) {
    if (!isRecord(payload)) return;
    if (isRecord(payload.snapshot)) { ingestSnapshot(ctx, payload.snapshot); return; }
    if (Array.isArray(payload.messages)) { ingestSnapshot(ctx, payload); return; }
    if (isRecord(payload.event)) { handleHostEvent(ctx, payload.event); return; }
    if (isRecord(payload) && typeof payload.type === "string") handleHostEvent(ctx, payload);
  }

