
import type { AskState } from "./ask-types.ts";

export const saved = new Map<string, AskState>();

export const keyOf = (session: string, id: string) => `${session}:${id}`;
