import { read } from "./output/read.ts";
import { close } from "./lifecycle/close.ts";
import { subscribe } from "./notifications/subscribe.ts";
import { send } from "./input/send.ts";
import { key } from "./input/key.ts";
import { interrupt } from "./input/interrupt.ts";
import { closeAll } from "./lifecycle/close-all.ts";
import { hasRunning } from "./commands/has-running.ts";
import { setTerminal } from "./notifications/set.ts";
import { listTerminals } from "./output/list.ts";
import { snapshot } from "./output/get-snapshot.ts";
import { subscribeState } from "./notifications/subscribe-state.ts";
import type { TerminalNotice } from "./model-terminals-types.ts";
import type { TerminalSend } from "./model-terminals-types.ts";
import type { TerminalKey } from "./model-terminals-types.ts";
import type { TerminalRead } from "./model-terminals-types.ts";
import type { TerminalSet } from "./model-terminals-types.ts";
import type { ModelTerminals } from "./model-terminals-types.ts";
import type { ModelTerminalContext } from "./model-terminals-types.ts";
import type { Command } from "./model-terminals-types.ts";
import type { ModelTerminal } from "./model-terminals-types.ts";
import type { ModelTerminalsContext } from "./terminal-state.ts";

export function createModelTerminals({ sessionId, context, environment, terminals, options, limits }: ModelTerminalContext): ModelTerminals {
  const ctx: ModelTerminalsContext = {
    sessionId, context, environment, terminals, options, limits,
    entries: new Map<string, ModelTerminal>(),
    openings: new Map<string, Promise<ModelTerminal>>(),
    restartTasks: new Map<string, Promise<void>>(),
    restartErrors: new Map<string, Error>(),
    history: new Map<string, Command>(),
    historyBytes: 0,
    listeners: new Set<(event: TerminalNotice) => void>(),
    stateListeners: new Set(),
    stopped: false,
  };
  return {
    list() { return listTerminals(ctx); },
    getSnapshot() { return snapshot(ctx); },
    subscribeState(listener) { return subscribeState(ctx, listener); },
    send(input: TerminalSend, signal?: AbortSignal) { return send(ctx, input, signal); },
    key(input: TerminalKey, signal?: AbortSignal) { return key(ctx, input, signal); },
    interrupt(name, generation, commandId) { return interrupt(ctx, name, generation, commandId); },
    read(input: TerminalRead, signal?: AbortSignal) { return read(ctx, input, signal); },
    set(input: TerminalSet) { return setTerminal(ctx, input); },
    closeAll() { return closeAll(ctx); },
    hasRunning() { return hasRunning(ctx); },
    subscribe(listener: (event: TerminalNotice) => void) { return subscribe(ctx, listener); },
    close(name: string) { return close(ctx, name); },
  };
}
