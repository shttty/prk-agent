import type { SessionHostEvent } from "../../sessions/host/host-types.ts";
import type { Options } from "./content-types.ts";
import { projectToolDetails } from "./format-details.ts";

export function projectToolEvent(event: SessionHostEvent, options: Options): SessionHostEvent {
  return event.details ? { ...event, details: projectToolDetails(event.details, options) } : event;
}
