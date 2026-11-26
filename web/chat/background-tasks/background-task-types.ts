import type { KernelSnapshot, SessionHostSnapshot } from "../../../src/gateway/wire/web-types.ts";

export type KernelCell = KernelSnapshot["activeCells"][number];
export type TerminalInfo = NonNullable<SessionHostSnapshot["terminals"]>[number];

type TaskBase = { id: string; key: string; startedAt: number; displayName: string | undefined };
export type KernelTask = KernelCell & TaskBase & { kind: "kernel" };
export type TerminalTask = TaskBase & {
  kind: "terminal"; name: string; generation: string; commandId: string;
  waitingForAsk?: undefined; mode?: undefined; language?: undefined; status?: undefined; kernelId?: undefined; cellId?: undefined; activeMs?: undefined; elapsedMs?: undefined;
};
export type BackgroundTask = KernelTask | TerminalTask;
