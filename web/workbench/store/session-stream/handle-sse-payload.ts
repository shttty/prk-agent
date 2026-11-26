import type { StoreContext } from "../store-context-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { ingestSnapshot } from "./ingest-snapshot.ts";
import { handleHostEvent } from "./handle-host-event.ts";

/** A frame of the session stream: a snapshot (bare or wrapped) or a host event (bare or wrapped). */
export function handleSsePayload(ctx: StoreContext, payload: unknown) {
  if (!isRecord(payload)) return;
  if (isRecord(payload.snapshot)) { ingestSnapshot(ctx, payload.snapshot); return; }
  if (Array.isArray(payload.messages)) { ingestSnapshot(ctx, payload); return; }
  if (isRecord(payload.event)) { handleHostEvent(ctx, payload.event); return; }
  if (typeof payload.type === "string") handleHostEvent(ctx, payload);
}
