import type { ToolLibraryContext } from "../library-state.ts";
import type { ToolLibraryEntry } from "../library-types.ts";
import { age } from "../curation/age-library.ts";

export function list(ctx: ToolLibraryContext, target?: string): ToolLibraryEntry[] {
  age(ctx);
  return ctx.records.map(({ sessions, createdAt: _created, changedAt: _changed, promotionReady: _ready, ...record }) => {
    const availability = target ? ctx.availability.get(target)?.get(`${record.name}:${record.version}`) : undefined;
    return { ...record, imports: [...record.imports], distinctSessions: sessions.length,
      ...(availability === undefined ? {} : { available: availability.available,
        ...(availability.unavailableReason === undefined ? {} : { unavailableReason: availability.unavailableReason }) }) };
  }).sort((a, b) => a.name.localeCompare(b.name) || b.version - a.version);
}
