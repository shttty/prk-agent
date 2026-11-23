import { memoryList } from "./list-memories.ts";
import { memoryChange } from "./change-memory.ts";
import { memoryDeleteInstance } from "./delete-instance-memory.ts";
import { memoryConfigGet } from "./memory-config.ts";
import { memoryConfigSave } from "./save-memory-config.ts";
import type { HostContext } from "../host/host-state.ts";
import type { MemoriesMethods } from "./memories-methods.ts";

export function assembleMemories(ctx: HostContext): MemoriesMethods {
  return {
    memoryList: memoryList.bind(undefined, ctx),
    memoryChange: memoryChange.bind(undefined, ctx),
    memoryDeleteInstance: memoryDeleteInstance.bind(undefined, ctx),
    memoryConfigGet: memoryConfigGet.bind(undefined, ctx),
    memoryConfigSave: memoryConfigSave.bind(undefined, ctx),
  };
}
