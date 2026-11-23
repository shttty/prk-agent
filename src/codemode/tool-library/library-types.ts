import type { Static } from "typebox";
import type { metadataSchema, storedSchema, availabilitySchema } from "./library-schema.ts";

export type ToolSource = Static<typeof metadataSchema>;
export type StoredTool = Static<typeof storedSchema>;
export type ToolLibraryEntry = ToolSource & {
  version: number; status: "staging" | "promoted" | "archived"; manual: boolean; distinctSessions: number; successfulCalls: number;
  lastUsedAt?: string; available?: boolean; unavailableReason?: string;
};
export type ToolLibraryAction = "promote" | "demote" | "archive" | "restore" | "delete";
export type Availability = Static<typeof availabilitySchema>;
