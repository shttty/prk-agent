import type { ConfigValues } from "../capability-types.ts";

export const getPath = (object: ConfigValues | undefined, key: string): unknown => key.split(".").reduce<unknown>((value, part) => (value !== null && typeof value === "object" ? Object.entries(value).find(([name]) => name === part)?.[1] : undefined), object);
