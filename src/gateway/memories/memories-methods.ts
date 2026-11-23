import type { memoryList } from "./list-memories.ts";
import type { memoryChange } from "./change-memory.ts";
import type { memoryDeleteInstance } from "./delete-instance-memory.ts";
import type { memoryConfigGet } from "./memory-config.ts";
import type { memoryConfigSave } from "./save-memory-config.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface MemoriesMethods {
  memoryList: WithoutContext<typeof memoryList>;
  memoryChange: WithoutContext<typeof memoryChange>;
  memoryDeleteInstance: WithoutContext<typeof memoryDeleteInstance>;
  memoryConfigGet: WithoutContext<typeof memoryConfigGet>;
  memoryConfigSave: WithoutContext<typeof memoryConfigSave>;
}
