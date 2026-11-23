import { group } from "./group.ts";

export function parseLibraryOptions<T extends object>(name: string, value: unknown, defaults: T): T {
  return group(name, value, defaults as unknown as Record<string, unknown>) as unknown as T;
}
