import { MEMORY_ENTRY_DELIMITER } from "../memory-constants.ts";

export function entries(raw: string | undefined): string[] {
  return (raw ?? "").split(MEMORY_ENTRY_DELIMITER).map((entry) => entry.trim()).filter(Boolean);
}
