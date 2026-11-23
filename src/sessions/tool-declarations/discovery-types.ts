import type { ToolLoadout, ToolLoadoutChanges } from "@earendil-works/pi-coding-agent";
import type { ToolDeclarations } from "./declaration-types.ts";

export interface ToolDiscovery {
  declarations(): ToolDeclarations;
  inventory(): readonly { name: string; enabled: boolean }[];
  prepareLoadout(loadout: ToolLoadout): ToolLoadoutChanges;
}
